// Pure model tests for dsh-context-monitor model.js.
// No host, no Kiva, no real provider, no zod, no index.js import.
// Run: node --test test/model.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KEY, MAX_SAMPLES, MAX_BLOCKS,
  initialState, readLedger, usageSample, fold,
} from '../model.js';

// ---------------- helpers ----------------
// Build a fold event. surfaceOp/sourceEventSeqs only attach when explicitly passed.
const ev = (type, data = {}, opts = {}) => ({
  type,
  data,
  seq: opts.seq ?? 1,
  time: opts.time ?? 1000,
  ...(opts.surfaceOp !== undefined ? { surfaceOp: opts.surfaceOp } : {}),
  ...(opts.sourceEventSeqs !== undefined ? { sourceEventSeqs: opts.sourceEventSeqs } : {}),
});

const ledgerRaw = obj => [{ type: 'text', text: JSON.stringify(obj) }];
const kivaLedger = (tier, id, parents = [], topic = 't') =>
  ledgerRaw({ $dshAcpBlockLedger: 1, tier, kernelBlockId: id, topic, parentBlockIds: parents });

// Build a state containing one block; optionally checkpoint it.
const withBlock = (id = 'c1', opts = {}) => {
  let s = initialState();
  s = fold(s, ev('compaction/summary', {
    compactionId: id,
    rawOutput: opts.kiva ? kivaLedger(opts.tier ?? 2, id, opts.parents ?? []) : [],
    summary: [{ type: 'text', text: 'x'.repeat(40) }],
    shadowedRange: { start: 1, end: 10 },
    shadowedSeqs: [1, 2, 3],
    shadowedTokenCount: 500,
  }, { seq: 1 }));
  if (opts.checkpoint) {
    s = fold(s, ev('user/message', { source: { kind: 'compact-checkpoint', compactionId: id } },
      { seq: 2, surfaceOp: { op: 'replace' }, ...(opts.exactSeqs ? { sourceEventSeqs: opts.exactSeqs } : {}) }));
  }
  return s;
};

// ================= 1. initialState =================
test('initialState: exact shape and null/zero defaults', () => {
  const s = initialState();
  assert.equal(s.provider, null);
  assert.equal(s.model, null);
  assert.equal(s.contextWindow, null);
  assert.deepEqual(s.samples, []);
  assert.deepEqual(s.blocks, []);
  assert.equal(s.sampleCount, 0);
  assert.equal(s.blockCount, 0);
  assert.equal(s.droppedSamples, 0);
  assert.equal(s.droppedBlocks, 0);
  assert.equal(s.malformedLedgers, 0);
  assert.equal(KEY, 'localContextMonitor');
});

test('initialState: fresh object each call (no shared mutable state)', () => {
  const a = initialState();
  const b = initialState();
  assert.notEqual(a, b);
  assert.notEqual(a.samples, b.samples);
  assert.notEqual(a.blocks, b.blocks);
});

// ================= 2. usageSample: exclusive buckets =================
test('usageSample: disjoint buckets sum to input (exclusive model)', () => {
  const u = usageSample({ inputTokens: 100, cacheReadTokens: 30, cacheWriteTokens: 20, outputTokens: 50 });
  assert.equal(u.uncached, 100);
  assert.equal(u.read, 30);
  assert.equal(u.write, 20);
  assert.equal(u.input, 150); // 100 + 30 + 20
  assert.equal(u.output, 50);
  assert.equal(u.hit, 30 / 150);
});

test('usageSample: cacheRead NOT reported → read null, hit null', () => {
  const u = usageSample({ inputTokens: 100, cacheWriteTokens: 20, outputTokens: 50 });
  assert.equal(u.read, null);
  assert.equal(u.hit, null);
  assert.equal(u.input, 120); // 100 + 0 + 20
});

test('usageSample: cacheRead explicitly 0 → hit 0 (distinct from not-reported null)', () => {
  const zero = usageSample({ inputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 20, outputTokens: 50 });
  const missing = usageSample({ inputTokens: 100, cacheWriteTokens: 20, outputTokens: 50 });
  assert.equal(zero.read, 0);
  assert.equal(zero.hit, 0);
  assert.equal(missing.read, null);
  assert.equal(missing.hit, null);
  assert.notEqual(zero.hit, missing.hit); // 0 !== null
});

test('usageSample: input===0 → hit null even with a read value', () => {
  const u = usageSample({ inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 10 });
  assert.equal(u.input, 0);
  assert.equal(u.hit, null);
});

// ================= 3. usageSample: illegal numbers =================
test('usageSample: null/undefined usage → null', () => {
  assert.equal(usageSample(null), null);
  assert.equal(usageSample(undefined), null);
});

test('usageSample: missing/invalid inputTokens → null (negative, NaN, Infinity, string)', () => {
  assert.equal(usageSample({}), null);
  assert.equal(usageSample({ inputTokens: undefined }), null);
  assert.equal(usageSample({ inputTokens: -5 }), null);
  assert.equal(usageSample({ inputTokens: NaN }), null);
  assert.equal(usageSample({ inputTokens: Infinity }), null);
  assert.equal(usageSample({ inputTokens: '100' }), null);
});

test('usageSample: invalid sub-buckets coerce to null, do not reject the sample', () => {
  const u = usageSample({ inputTokens: 100, cacheReadTokens: 'bad', cacheWriteTokens: -1, outputTokens: 'x' });
  assert.equal(u.uncached, 100);
  assert.equal(u.read, null);
  assert.equal(u.write, null);
  assert.equal(u.output, null);
  assert.equal(u.input, 100); // 100 + 0 + 0
});

// ================= 4. readLedger: Kiva v1 / T2 / T3 =================
test('readLedger: Kiva v1 T2 with parent ids', () => {
  const r = readLedger(kivaLedger(2, 'b2', ['b1', 'b0']));
  assert.equal(r.supported, true);
  assert.equal(r.tier, 2);
  assert.equal(r.kernelBlockId, 'b2');
  assert.deepEqual(r.parents, ['b1', 'b0']);
});

test('readLedger: Kiva v1 T3 with parent ids', () => {
  const r = readLedger(kivaLedger(3, 'b3', ['b1', 'b2']));
  assert.equal(r.supported, true);
  assert.equal(r.tier, 3);
  assert.equal(r.kernelBlockId, 'b3');
  assert.deepEqual(r.parents, ['b1', 'b2']);
});

test('readLedger: tier out of [1,2,3] → tier null, still supported', () => {
  const r = readLedger(ledgerRaw({ $dshAcpBlockLedger: 1, tier: 5, kernelBlockId: 'bx' }));
  assert.equal(r.supported, true);
  assert.equal(r.tier, null);
});

test('readLedger: parents filtered to strings, capped at 256, each sliced to 160', () => {
  const parents = ['a', 1, null, 'b'.repeat(200), ...Array.from({ length: 300 }, (_, i) => 'p' + i)];
  const r = readLedger(ledgerRaw({ $dshAcpBlockLedger: 1, tier: 2, kernelBlockId: 'b1', parentBlockIds: parents }));
  assert.equal(r.parents.length, 256);
  assert.equal(r.parents[0], 'a');
  assert.equal(r.parents[1].length, 160);
});

// ================= 5. readLedger: unsupported version =================
test('readLedger: $dshAcpBlockLedger version != 1 → { supported: false }', () => {
  const r = readLedger(ledgerRaw({ $dshAcpBlockLedger: 2, tier: 1 }));
  assert.deepEqual(r, { supported: false });
});

// ================= 6. readLedger: generic without Kiva =================
test('readLedger: no ledger marker → null', () => {
  assert.equal(readLedger(ledgerRaw({ foo: 'bar' })), null);
});

test('readLedger: raw not an array → null', () => {
  assert.equal(readLedger('nope'), null);
  assert.equal(readLedger(null), null);
  assert.equal(readLedger(undefined), null);
});

test('readLedger: empty text / bad JSON / primitive JSON / array JSON / null JSON → null', () => {
  assert.equal(readLedger([{ type: 'text', text: '' }]), null);
  assert.equal(readLedger([{ type: 'text', text: '{bad json' }]), null);
  assert.equal(readLedger([{ type: 'text', text: '42' }]), null);
  assert.equal(readLedger([{ type: 'text', text: 'null' }]), null);
  assert.equal(readLedger([{ type: 'text', text: '[]' }]), null);
});

test('readLedger: non-text items skipped, first valid ledger wins', () => {
  const r = readLedger([
    { type: 'image' },
    { type: 'text', text: JSON.stringify({ $dshAcpBlockLedger: 1, tier: 1, kernelBlockId: 'k' }) },
  ]);
  assert.equal(r.supported, true);
  assert.equal(r.kernelBlockId, 'k');
});

test('readLedger: text longer than 262144 is skipped → null', () => {
  const long = JSON.stringify({ $dshAcpBlockLedger: 1, tier: 1, kernelBlockId: 'long', pad: 'a'.repeat(262145) });
  assert.ok(long.length > 262144, `payload must exceed the cap, got ${long.length}`);
  assert.equal(readLedger([{ type: 'text', text: long }]), null);
});

// ================= 7. fold: request/header + request/context =================
test('fold: request/header sets provider/model and resets contextWindow', () => {
  let s = initialState();
  s = fold(s, ev('request/context', { provider: 'p', model: 'm', contextWindow: 8192 }));
  assert.equal(s.contextWindow, 8192);
  s = fold(s, ev('request/header', { header: { config: { provider: 'p2', model: 'm2' } } }));
  assert.equal(s.provider, 'p2');
  assert.equal(s.model, 'm2');
  assert.equal(s.contextWindow, null); // header resets the window
});

test('fold: request/header with unchanged provider/model → same reference', () => {
  let s = initialState();
  s = fold(s, ev('request/header', { header: { config: { provider: 'p', model: 'm' } } }));
  const s2 = fold(s, ev('request/header', { header: { config: { provider: 'p', model: 'm' } } }));
  assert.equal(s2, s);
});

test('fold: request/header without config → same reference', () => {
  const s = initialState();
  assert.equal(fold(s, ev('request/header', { header: {} })), s);
  assert.equal(fold(s, ev('request/header', { config: { provider: 'p' } })), s);
});

test('fold: request/context unchanged → same reference', () => {
  let s = initialState();
  s = fold(s, ev('request/context', { provider: 'p', model: 'm', contextWindow: 4096 }));
  assert.equal(fold(s, ev('request/context', { provider: 'p', model: 'm', contextWindow: 4096 })), s);
});

// ================= 8. fold: assistant/message =================
test('fold: assistant/message adds a fully-populated sample', () => {
  let s = initialState();
  s = fold(s, ev('request/header', { header: { config: { provider: 'p', model: 'm' } } }));
  s = fold(s, ev('request/context', { provider: 'p', model: 'm', contextWindow: 4096 }));
  s = fold(s, ev('assistant/message', { usage: { inputTokens: 100, outputTokens: 10 }, turn: 1, step: 2 }, { seq: 7, time: 2000 }));
  assert.equal(s.sampleCount, 1);
  const sample = s.samples.at(-1);
  assert.equal(sample.seq, 7);
  assert.equal(sample.time, 2000);
  assert.equal(sample.turn, 1);
  assert.equal(sample.step, 2);
  assert.equal(sample.provider, 'p');
  assert.equal(sample.model, 'm');
  assert.equal(sample.window, 4096);
  assert.equal(sample.input, 100);
  assert.equal(sample.output, 10);
});

test('fold: repeated same (turn,step) replaces the visible sample, counted once', () => {
  let s = initialState();
  const base = { usage: { inputTokens: 100, outputTokens: 10 }, turn: 3, step: 5 };
  s = fold(s, ev('assistant/message', base, { seq: 1 }));
  s = fold(s, ev('assistant/message', base, { seq: 2 }));
  s = fold(s, ev('assistant/message', base, { seq: 3 }));
  assert.equal(s.sampleCount, 1); // dedup: only one logical sample
  assert.equal(s.samples.length, 1);
  assert.equal(s.samples.at(-1).seq, 3); // last assembly wins
  assert.equal(s.droppedSamples, 0);
});

test('fold: a different step appends (counted again)', () => {
  let s = initialState();
  s = fold(s, ev('assistant/message', { usage: { inputTokens: 100 }, turn: 1, step: 1 }, { seq: 1 }));
  s = fold(s, ev('assistant/message', { usage: { inputTokens: 100 }, turn: 1, step: 2 }, { seq: 2 }));
  assert.equal(s.sampleCount, 2);
  assert.equal(s.samples.length, 2);
});

test('fold: null turn/step → never deduped, always appends', () => {
  let s = initialState();
  s = fold(s, ev('assistant/message', { usage: { inputTokens: 100 } }, { seq: 1 }));
  s = fold(s, ev('assistant/message', { usage: { inputTokens: 100 } }, { seq: 2 }));
  assert.equal(s.sampleCount, 2);
});

test('fold: assistant/message with no valid usage → same reference', () => {
  const s = initialState();
  assert.equal(fold(s, ev('assistant/message', {})), s);
  assert.equal(fold(s, ev('assistant/message', { usage: null })), s);
});

// ================= 9. fold: compaction/summary =================
test('fold: summary → uncommitted generic block (no Kiva)', () => {
  const s = withBlock('c1');
  assert.equal(s.blockCount, 1);
  const b = s.blocks.at(-1);
  assert.equal(b.id, 'c1');
  assert.equal(b.status, 'uncommitted');
  assert.equal(b.acp, false);
  assert.equal(b.ledgerUnsupported, false);
  assert.equal(b.closed, false);
  assert.equal(b.error, false);
  assert.equal(b.checkpointSeq, null);
  assert.equal(b.messages, 3);
  assert.equal(b.originalTokens, 500);
  assert.equal(b.summaryTokensEstimate, 10); // ceil(40/4)
});

test('fold: summary with Kiva T2 ledger → acp true, ref + parents carried', () => {
  const s = withBlock('c1', { kiva: true, tier: 2, parents: ['b0'] });
  const b = s.blocks.at(-1);
  assert.equal(b.acp, true);
  assert.equal(b.tier, 2);
  assert.equal(b.ref, 'c1');
  assert.deepEqual(b.parents, ['b0']);
  assert.equal(s.malformedLedgers, 0);
});

test('fold: summary with unsupported ledger → ledgerUnsupported + malformedLedgers++', () => {
  let s = initialState();
  s = fold(s, ev('compaction/summary', {
    compactionId: 'c1',
    rawOutput: ledgerRaw({ $dshAcpBlockLedger: 2 }),
    summary: [{ type: 'text', text: 'hi' }],
  }, { seq: 1 }));
  const b = s.blocks.at(-1);
  assert.equal(b.ledgerUnsupported, true);
  assert.equal(b.acp, false);
  assert.equal(s.malformedLedgers, 1);
});

test('fold: duplicate compactionId → same reference (idempotent)', () => {
  let s = initialState();
  s = fold(s, ev('compaction/summary', { compactionId: 'c1', rawOutput: [] }, { seq: 1 }));
  assert.equal(fold(s, ev('compaction/summary', { compactionId: 'c1', rawOutput: [] }, { seq: 2 })), s);
  assert.equal(s.blockCount, 1);
});

test('fold: summary without compactionId → same reference', () => {
  const s = initialState();
  assert.equal(fold(s, ev('compaction/summary', { rawOutput: [] }, { seq: 1 })), s);
});

// ================= 10. fold: checkpoint (user/message replace) =================
test('fold: compact-checkpoint replace makes block resident', () => {
  let s = withBlock('c1');
  s = fold(s, ev('user/message', { source: { kind: 'compact-checkpoint', compactionId: 'c1' } },
    { seq: 42, surfaceOp: { op: 'replace' }, sourceEventSeqs: [1, 2, 3] }));
  const b = s.blocks.at(-1);
  assert.equal(b.status, 'resident');
  assert.equal(b.checkpointSeq, 42);
});

test('fold: plugin-compact source also recognized as checkpoint', () => {
  let s = withBlock('c1');
  s = fold(s, ev('user/message', { source: { kind: 'plugin', plugin: 'compact', compactionId: 'c1' } },
    { seq: 42, surfaceOp: { op: 'replace' }, sourceEventSeqs: [1] }));
  assert.equal(s.blocks.at(-1).status, 'resident');
});

test('fold: checkpoint only applies on surfaceOp.replace (insert is ignored)', () => {
  let s = withBlock('c1');
  s = fold(s, ev('user/message', { source: { kind: 'compact-checkpoint', compactionId: 'c1' } },
    { seq: 42, surfaceOp: { op: 'insert' } }));
  assert.equal(s.blocks.at(-1).status, 'uncommitted');
});

test('fold: tool/result checkpoints via message.source', () => {
  let s = withBlock('c1');
  s = fold(s, ev('tool/result', { message: { source: { kind: 'compact-checkpoint', compactionId: 'c1' } } },
    { seq: 42, surfaceOp: { op: 'replace' }, sourceEventSeqs: [1] }));
  assert.equal(s.blocks.at(-1).status, 'resident');
});

// "summary not on a checkpoint does not masquerade as active":
test('fold: uncheckpointed summary stays uncommitted through a plain replace', () => {
  let s = initialState();
  s = fold(s, ev('compaction/summary', { compactionId: 'a', rawOutput: [] }, { seq: 1 }));
  s = fold(s, ev('compaction/summary', { compactionId: 'b', rawOutput: [] }, { seq: 2 }));
  // A non-compact user message replace: no id, no nextBlock, no exact provenance.
  s = fold(s, ev('user/message', { source: { kind: 'user' } },
    { seq: 3, surfaceOp: { op: 'replace' } }));
  const a = s.blocks.find(x => x.id === 'a');
  const b = s.blocks.find(x => x.id === 'b');
  assert.equal(a.status, 'uncommitted'); // not promoted
  assert.equal(b.status, 'uncommitted');
});

// ================= 11. fold: closed (compaction/end) =================
test('fold: end without error → closed, error false (success)', () => {
  let s = withBlock('c1', { checkpoint: true });
  s = fold(s, ev('compaction/end', { compactionId: 'c1' }, { seq: 50 }));
  const b = s.blocks.at(-1);
  assert.equal(b.closed, true);
  assert.equal(b.error, false);
});

test('fold: end with error → closed, error true (failed transaction)', () => {
  let s = withBlock('c1', { checkpoint: true });
  s = fold(s, ev('compaction/end', { compactionId: 'c1', error: 'boom' }, { seq: 50 }));
  const b = s.blocks.at(-1);
  assert.equal(b.closed, true);
  assert.equal(b.error, true);
});

test('fold: end error=null → treated as success', () => {
  let s = withBlock('c1', { checkpoint: true });
  s = fold(s, ev('compaction/end', { compactionId: 'c1', error: null }, { seq: 50 }));
  assert.equal(s.blocks.at(-1).error, false);
});

test('fold: failed transaction — end error before checkpoint (never resident)', () => {
  let s = withBlock('c1');
  s = fold(s, ev('compaction/end', { compactionId: 'c1', error: 'tx failed' }, { seq: 50 }));
  const b = s.blocks.at(-1);
  assert.equal(b.closed, true);
  assert.equal(b.error, true);
  assert.equal(b.status, 'uncommitted'); // checkpoint never happened
});

test('fold: end for already-closed block → same reference (idempotent)', () => {
  let s = withBlock('c1', { checkpoint: true });
  s = fold(s, ev('compaction/end', { compactionId: 'c1' }, { seq: 50 }));
  assert.equal(fold(s, ev('compaction/end', { compactionId: 'c1' }, { seq: 51 })), s);
});

test('fold: end for unknown id → same reference', () => {
  const s = initialState();
  assert.equal(fold(s, ev('compaction/end', { compactionId: 'ghost' }, { seq: 50 })), s);
});

// ================= 12. fold: non-monotonic seq / provenance =================
// The model must not assume numeric seq order equals surface order.
test('fold: resident blocks without exact provenance → unknown, not seq-ordered', () => {
  let s = initialState();
  // A resident at seq=10, B resident at seq=5 (deliberately non-monotonic).
  s = fold(s, ev('compaction/summary', { compactionId: 'A', rawOutput: [] }, { seq: 1 }));
  s = fold(s, ev('user/message', { source: { kind: 'compact-checkpoint', compactionId: 'A' } },
    { seq: 10, surfaceOp: { op: 'replace' }, sourceEventSeqs: [1] }));
  s = fold(s, ev('compaction/summary', { compactionId: 'B', rawOutput: [] }, { seq: 2 }));
  s = fold(s, ev('user/message', { source: { kind: 'compact-checkpoint', compactionId: 'B' } },
    { seq: 5, surfaceOp: { op: 'replace' }, sourceEventSeqs: [2] }));
  // A plain user replace with no compact source and no exact seqs.
  s = fold(s, ev('user/message', { source: { kind: 'user' } },
    { seq: 20, surfaceOp: { op: 'replace' } }));
  const A = s.blocks.find(x => x.id === 'A');
  const B = s.blocks.find(x => x.id === 'B');
  assert.equal(A.status, 'unknown'); // can't infer surface order from seq
  assert.equal(B.status, 'unknown');
});

test('fold: exact sourceEventSeqs drive "folded" (provenance, not seq order)', () => {
  let s = initialState();
  s = fold(s, ev('compaction/summary', { compactionId: 'A', rawOutput: [] }, { seq: 1 }));
  s = fold(s, ev('user/message', { source: { kind: 'compact-checkpoint', compactionId: 'A' } },
    { seq: 10, surfaceOp: { op: 'replace' }, sourceEventSeqs: [1] }));
  // Checkpoint B with exact provenance that includes A's checkpointSeq (10).
  s = fold(s, ev('compaction/summary', { compactionId: 'B', rawOutput: [] }, { seq: 2 }));
  s = fold(s, ev('user/message', { source: { kind: 'compact-checkpoint', compactionId: 'B' } },
    { seq: 20, surfaceOp: { op: 'replace' }, sourceEventSeqs: [2, 10] }));
  const A = s.blocks.find(x => x.id === 'A');
  const B = s.blocks.find(x => x.id === 'B');
  assert.equal(B.status, 'resident');
  assert.equal(A.status, 'folded'); // A.checkpointSeq (10) is in B's exact set
});

test('fold: Kiva parent ids (T2/T3) drive "folded" when no exact seqs', () => {
  let s = initialState();
  s = fold(s, ev('compaction/summary', { compactionId: 'A', rawOutput: [] }, { seq: 1 }));
  s = fold(s, ev('user/message', { source: { kind: 'compact-checkpoint', compactionId: 'A' } },
    { seq: 10, surfaceOp: { op: 'replace' } }));
  // B's Kiva T3 ledger names A as a durable parent.
  s = fold(s, ev('compaction/summary', { compactionId: 'B', rawOutput: kivaLedger(3, 'B', ['A']) }, { seq: 2 }));
  s = fold(s, ev('user/message', { source: { kind: 'compact-checkpoint', compactionId: 'B' } },
    { seq: 20, surfaceOp: { op: 'replace' } }));
  const A = s.blocks.find(x => x.id === 'A');
  assert.equal(A.status, 'folded'); // via nextBlock.parents
});

// ================= 13. fold: state immutability =================
test('fold: does not mutate the input state', () => {
  let s = initialState();
  s = fold(s, ev('compaction/summary', { compactionId: 'c1', rawOutput: [] }, { seq: 1 }));
  const snapshot = JSON.parse(JSON.stringify(s));
  const s2 = fold(s, ev('user/message', { source: { kind: 'compact-checkpoint', compactionId: 'c1' } },
    { seq: 2, surfaceOp: { op: 'replace' }, sourceEventSeqs: [1] }));
  assert.notEqual(s2, s);
  assert.deepEqual(s, snapshot); // original untouched
  assert.equal(s.blocks.at(-1).status, 'uncommitted');
  assert.equal(s2.blocks.at(-1).status, 'resident');
});

test('fold: ignored events return the SAME reference', () => {
  const s = initialState();
  assert.equal(fold(s, { type: 'unknown/thing' }), s);
  assert.equal(fold(s, null), s);
  assert.equal(fold(s, undefined), s);
  assert.equal(fold(s, {}), s); // no data
  assert.equal(fold(s, ev('request/header', { header: {} })), s);
  assert.equal(fold(s, ev('assistant/message', {})), s);
  assert.equal(fold(s, ev('compaction/summary', { rawOutput: [] }, { seq: 1 })), s); // no id
});

// ================= 14. fold: caps 600 / 400 =================
test('fold: samples capped at MAX_SAMPLES (600), overflow tracked', () => {
  assert.equal(MAX_SAMPLES, 600);
  let s = initialState();
  for (let i = 0; i < 601; i++) {
    s = fold(s, ev('assistant/message', { usage: { inputTokens: 10 }, turn: i, step: 0 }, { seq: i }));
  }
  assert.equal(s.samples.length, 600);
  assert.equal(s.droppedSamples, 1);
  assert.equal(s.sampleCount, 601); // logical count includes the dropped one
  assert.equal(s.samples.at(0).turn, 1); // turn 0 fell off the tail
});

test('fold: blocks capped at MAX_BLOCKS (400), overflow tracked', () => {
  assert.equal(MAX_BLOCKS, 400);
  let s = initialState();
  for (let i = 0; i < 401; i++) {
    s = fold(s, ev('compaction/summary', { compactionId: 'c' + i, rawOutput: [] }, { seq: i }));
  }
  assert.equal(s.blocks.length, 400);
  assert.equal(s.droppedBlocks, 1);
  assert.equal(s.blockCount, 401);
  assert.equal(s.blocks.at(0).id, 'c1'); // c0 fell off
});

// ================= 15. fold: JSON round-trip / fork-consistent derivation =================
// Pure derivation: fold is a pure function of (state, event). A host that
// rehydrates state from JSON (a plain fork) must derive identically.
test('fold: JSON round-trip preserves state and future derivation', () => {
  let s = initialState();
  s = fold(s, ev('request/header', { header: { config: { provider: 'p', model: 'm' } } }));
  s = fold(s, ev('compaction/summary', { compactionId: 'c1', rawOutput: kivaLedger(2, 'c1', ['b0']) }, { seq: 1 }));
  s = fold(s, ev('user/message', { source: { kind: 'compact-checkpoint', compactionId: 'c1' } },
    { seq: 2, surfaceOp: { op: 'replace' }, sourceEventSeqs: [1] }));
  s = fold(s, ev('compaction/end', { compactionId: 'c1' }, { seq: 3 }));
  s = fold(s, ev('assistant/message', { usage: { inputTokens: 50 }, turn: 1, step: 1 }, { seq: 4 }));

  const rehydrated = JSON.parse(JSON.stringify(s));
  assert.deepEqual(rehydrated, s); // structurally identical

  // Apply an identical next event to both; derivation must agree.
  const next = ev('compaction/summary', { compactionId: 'c2', rawOutput: [] }, { seq: 5 });
  assert.deepEqual(fold(s, next), fold(rehydrated, next));
});

test('fold: independent block ids derive consistently (plain fork, new id)', () => {
  let s = initialState();
  // Block A lifecycle.
  s = fold(s, ev('compaction/summary', { compactionId: 'A', rawOutput: [] }, { seq: 1 }));
  s = fold(s, ev('user/message', { source: { kind: 'compact-checkpoint', compactionId: 'A' } },
    { seq: 2, surfaceOp: { op: 'replace' }, sourceEventSeqs: [1] }));
  // Block B — a fork producing a new id; its lifecycle must not disturb A.
  s = fold(s, ev('compaction/summary', { compactionId: 'B', rawOutput: [] }, { seq: 3 }));
  s = fold(s, ev('user/message', { source: { kind: 'compact-checkpoint', compactionId: 'B' } },
    { seq: 4, surfaceOp: { op: 'replace' }, sourceEventSeqs: [3] }));
  const A = s.blocks.find(b => b.id === 'A');
  const B = s.blocks.find(b => b.id === 'B');
  assert.equal(A.status, 'resident'); // not collapsed into B
  assert.equal(B.status, 'resident');
  assert.equal(A.checkpointSeq, 2);
  assert.equal(B.checkpointSeq, 4);
});
