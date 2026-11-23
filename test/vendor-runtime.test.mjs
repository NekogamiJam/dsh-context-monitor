import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  OPERATION_KINDS,
  assertAcpRuntime,
  isAcpRuntime,
  readInitialRuntimeConfig,
  runRequiredOperation,
  surfaceSeqBounds,
  validateRecognizedAcpLedgerEntry,
} from '../acp/vendor/runtime.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('vendor runtime validates the injected coordinator surface', () => {
  const runtime = { readConfig: () => ({ autoNudge: true }), runOperation: (_kind, fn) => fn() };
  assert.equal(isAcpRuntime(runtime), true);
  assert.doesNotThrow(() => assertAcpRuntime(runtime));
  assert.equal(isAcpRuntime({ readConfig() {} }), false);
  assert.throws(() => assertAcpRuntime({}), /readConfig\(\).*runOperation/);
  assert.deepEqual(OPERATION_KINDS, ['nudge', 'overflow', 'compress', 'read', 'settings', 'prompt', 'cleanup']);
});

test('runtime snapshot is the sole config input; undefined Cordis refs cannot shadow defaults', () => {
  const volatileRef = { get: () => undefined };
  const composition = { modelContextLimit: volatileRef, autoNudge: volatileRef, runtime: { fake: true } };
  const runtime = {
    readConfig: () => ({ autoNudge: false, modelContextLimit: undefined, autoTools: true, prompts: { nudge: 'live' }, runtime: { ignored: true } }),
    runOperation: (_kind, fn) => fn(),
  };
  const snapshot = readInitialRuntimeConfig(runtime);
  assert.equal(snapshot.modelContextLimit, undefined);
  assert.equal(snapshot.autoNudge, false);
  assert.equal(snapshot.autoTools, true);
  assert.deepEqual(snapshot.prompts, { nudge: 'live' });
  assert.equal(Object.hasOwn(snapshot, 'runtime'), false);
  // `composition` intentionally is not an argument to this selector: injected
  // runtime mode cannot accidentally re-spread the schema reference object.
  assert.equal(composition.modelContextLimit.get(), undefined);
});

test('operation helper holds coordinator lease through asynchronous work and releases it', async () => {
  let leases = 0;
  const runtime = {
    readConfig: () => ({ autoNudge: true }),
    async runOperation(kind, fn) {
      assert.equal(kind, 'compress');
      leases += 1;
      try { return await fn(); } finally { leases -= 1; }
    },
  };
  const value = await runRequiredOperation(runtime, 'compress', async () => {
    assert.equal(leases, 1);
    await Promise.resolve();
    assert.equal(leases, 1);
    return 'committed';
  });
  assert.equal(value, 'committed');
  assert.equal(leases, 0);
});

test('manual operation fails visibly when coordinator refuses admission', async () => {
  let invoked = false;
  const runtime = { readConfig: () => ({}), runOperation: async () => null };
  await assert.rejects(runRequiredOperation(runtime, 'settings', () => { invoked = true; }), /settings operation is unavailable/);
  assert.equal(invoked, false);
});

test('non-monotonic surface seqs produce numeric bounds, not a reversed label', () => {
  assert.deepEqual(surfaceSeqBounds([8, 5, 6, 7]), { start: 5, end: 8 });
  assert.deepEqual(surfaceSeqBounds([15, 6, 7, 12]), { start: 6, end: 15 });
  assert.equal(surfaceSeqBounds([]), null);
});

test('recognized ACP ledger v1 validates original seqs and provenance; generic stock rows remain accepted', () => {
  const known = new Set();
  const blocks = new Set();
  const original = { type: 'user/message', seq: 0 };
  const stock = { type: 'compaction/summary', seq: 1, data: { compactionId: 'stock', shadowedSeqs: [0], shadowedRange: { start: 0, end: 0 }, summary: [{ type: 'text', text: 'stock' }] } };
  const stockEvents = [original, stock];
  validateRecognizedAcpLedgerEntry(stock, 1, stockEvents, known, blocks);
  assert.ok(known.has('stock'));

  const acp = { type: 'compaction/summary', seq: 2, data: {
    compactionId: 'acp-1', shadowedSeqs: [0], shadowedRange: { start: 0, end: 0 },
    rawOutput: [{ type: 'text', text: JSON.stringify({ $dshAcpBlockLedger: 1, tier: 1, kernelBlockId: 'b1', directMessageIds: ['m00001'], effectiveMessageIds: ['m00001'] }) }],
  } };
  validateRecognizedAcpLedgerEntry(acp, 2, [original, stock, acp], known, blocks);
  assert.ok(blocks.has('b1'));
  assert.ok(known.has('acp-1'));
  const distilled = { type: 'compaction/summary', seq: 3, data: {
    compactionId: 'acp-2', shadowedSeqs: [2], shadowedRange: { start: 2, end: 2 },
    rawOutput: [{ type: 'text', text: JSON.stringify({ $dshAcpBlockLedger: 1, tier: 2, kernelBlockId: 'b2', directMessageIds: [], effectiveMessageIds: ['m00001'], parentBlockIds: ['acp-1'] }) }],
  } };
  validateRecognizedAcpLedgerEntry(distilled, 3, [original, stock, acp, distilled], known, blocks);
  assert.ok(blocks.has('b2'));
  assert.ok(known.has('acp-2'));
});

test('recognized ACP ledger v1 rejects missing originals, provenance, and distillation parents', () => {
  const data = (id, payload, extra = {}) => ({ type: 'compaction/summary', seq: 2, data: { compactionId: id, shadowedSeqs: [0], shadowedRange: { start: 0, end: 0 }, ...extra, rawOutput: [{ type: 'text', text: JSON.stringify({ $dshAcpBlockLedger: 1, ...payload }) }] } });
  const original = { type: 'user/message', seq: 0 };
  const valid = { tier: 1, kernelBlockId: 'b1', directMessageIds: ['m1'], effectiveMessageIds: ['m1'] };
  const missingSeq = data('bad-seq', valid);
  missingSeq.data.shadowedSeqs = [9];
  assert.throws(() => validateRecognizedAcpLedgerEntry(missingSeq, 2, [original, {}, missingSeq], new Set(), new Set()), /missing an original event/);
  assert.throws(() => validateRecognizedAcpLedgerEntry(data('bad-prov', { tier: 1, kernelBlockId: 'b1' }), 2, [original, {}, {}], new Set(), new Set()), /message provenance is missing/);
  const parentlessT2 = data('bad-parent', { tier: 2, kernelBlockId: 'b2', directMessageIds: ['m2'], effectiveMessageIds: ['m2'] });
  assert.throws(() => validateRecognizedAcpLedgerEntry(parentlessT2, 2, [original, {}, parentlessT2], new Set(), new Set()), /parentBlockIds are missing/);
  const selfParent = data('self-parent', { tier: 2, kernelBlockId: 'b3', directMessageIds: [], effectiveMessageIds: ['m3'], parentBlockIds: ['self-parent'] });
  assert.throws(() => validateRecognizedAcpLedgerEntry(selfParent, 2, [original, {}, selfParent], new Set(), new Set()), /not present earlier/);
});

test('cleanup lease stays active until deferred microtask settles', async () => {
  let active = 0;
  let settle;
  const runtime = {
    readConfig: () => ({}),
    runOperation: async (kind, fn) => {
      assert.equal(kind, 'cleanup');
      active++;
      try { return await fn(); } finally { active--; }
    },
  };
  const op = runtime.runOperation('cleanup', () => new Promise(resolve => { settle = resolve; }));
  assert.equal(active, 1, 'lease is acquired synchronously before deferred work');
  settle();
  await op;
  assert.equal(active, 0, 'switch can proceed only after cleanup completes');
});

test('checked-in built engine carries runtime, nudge, decision-spread, and config-validation integration', async () => {
  const bundle = await readFile(path.join(root, 'acp/vendor/engine.js'), 'utf8');
  assert.match(bundle, /AcpCompactionEngine = class extends CompactionEngine/);
  assert.match(bundle, /this\.runtime === void 0 \? void 0 : readInitialRuntimeConfig\(this\.runtime\)/);
  assert.match(bundle, /const effectiveConfig = initialRuntimeConfig \?\?/);
  assert.match(bundle, /modelContextLimit: config\.modelContextLimit \?\? DEFAULT_CONTEXT_WINDOW/);
  assert.match(bundle, /AcpCompactionEngine runtime must provide readConfig\(\) and runOperation/);
  assert.match(bundle, /runOperation\("nudge"/);
  assert.match(bundle, /runOperation\("overflow"/);
  assert.match(bundle, /runOperation\("cleanup"/);
  assert.match(bundle, /pendingCompressPairHides/);
  assert.match(bundle, /validateRecognizedAcpLedgerEntry/);
  assert.match(bundle, /store\.stateFor\(session\)/);
  assert.match(bundle, /\.\.\.decision, kind: "enter"/);
  assert.match(bundle, /validateAdvancedConfig/);
});
