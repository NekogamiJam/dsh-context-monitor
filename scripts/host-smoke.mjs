#!/usr/bin/env node
/**
 * Read-only host smoke for this bundle's real DSH session projection.
 * Runs in an isolated Electron-as-Node process; creates only an in-memory
 * Cordis Context and detached synthetic Session. It never starts an agent,
 * provider, persistence service, or production session.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const installDir = process.env.DSH_INSTALL_DIR;
if (!installDir) throw new Error('DSH_INSTALL_DIR is required to resolve the running installation');
const dshRequire = createRequire(import.meta.url);
const dshImport = async packageName => import(pathToFileURL(
  dshRequire.resolve(packageName, { paths: [installDir] }),
).href);

const [{ Context }, { Session, SessionId }, { SessionProjectionRegistry }, { compactCheckpointSource }] = await Promise.all([
  dshImport('@deepseek-ai/cordis'),
  dshImport('@deepseek-ai/dsh-session'),
  dshImport('@deepseek-ai/dsh-session-projection'),
  dshImport('@deepseek-ai/dsh-compaction'),
]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginDir = path.resolve(scriptDir, '..');
const { definition } = await import(pathToFileURL(path.join(pluginDir, 'index.js')).href);
const { KEY } = await import(pathToFileURL(path.join(pluginDir, 'model.js')).href);

const context = new Context();
const registry = new SessionProjectionRegistry(context);
const projections = context.sessionProjections;
assert.ok(projections, 'Cordis should expose the installed SessionProjectionRegistry');
assert.equal(typeof projections.register, 'function');
const handle = await projections.register(definition);

try {
  // Detached Session.create() is the real in-memory event-sourced Session API.
  // It does not enter ctx.sessions or publish session/event to a persistence host.
  const session = Session.create(SessionId('dsh-context-monitor-host-smoke'));
  const provider = 'smoke-provider';
  const model = 'smoke-model';

  session.append('request/context', {
    provider,
    model,
    contextWindow: 200_000,
  });
  const assistant = session.append('assistant/message', {
    turn: 1,
    step: 1,
    message: {
      id: 'smoke-assistant-message',
      role: 'assistant',
      source: { kind: 'model', provider, model },
      content: [{ type: 'text', text: 'synthetic assistant result' }],
    },
    stream: [],
    usage: {
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 25,
      cacheWriteTokens: 15,
    },
  }, { surfaceOp: 'append' });

  const compactionId = 'smoke-compaction-1';
  session.append('compaction/start', { compactionId, turn: null });
  session.append('compaction/summary', {
    compactionId,
    summary: [{ type: 'text', text: 'synthetic compacted summary' }],
    shadowedRange: { start: assistant.seq, end: assistant.seq },
    shadowedSeqs: [assistant.seq],
    shadowedTokenCount: 123,
    provider,
    model,
    rawOutput: [{
      type: 'text',
      text: JSON.stringify({
        $dshAcpBlockLedger: 1,
        tier: 1,
        kernelBlockId: 'b-smoke',
        topic: 'host smoke',
        parentBlockIds: [],
      }),
    }],
  });
  const checkpoint = session.append('user/message', {
    id: 'smoke-checkpoint-message',
    role: 'user',
    source: compactCheckpointSource(compactionId),
    content: [{ type: 'text', text: 'synthetic compacted summary' }],
  }, {
    surfaceOp: { op: 'replace', startSeq: assistant.seq, endSeq: assistant.seq },
    sourceEventSeqs: [assistant.seq],
  });
  session.append('compaction/end', { compactionId, turn: null });

  const snapshot = projections.snapshot(session, [KEY]);
  assert.equal(snapshot.asOfSeq, session.seq - 1, 'snapshot watermark should cover the complete synthetic log');
  assert.ok(Object.hasOwn(snapshot.values, KEY), `snapshot should include ${KEY}`);
  const projected = snapshot.values[KEY];
  const retained = handle.stateOf(session);

  assert.deepEqual(projected, retained, 'wire snapshot and retained handle state should agree for this whole-state view');
  assert.equal(projected.provider, provider);
  assert.equal(projected.model, model);
  assert.equal(projected.contextWindow, 200_000);
  assert.equal(projected.samples.length, 1);
  assert.deepEqual(
    { input: projected.samples[0].input, uncached: projected.samples[0].uncached, read: projected.samples[0].read, write: projected.samples[0].write, output: projected.samples[0].output },
    { input: 140, uncached: 100, read: 25, write: 15, output: 20 },
  );
  assert.equal(projected.blocks.length, 1);
  assert.deepEqual(
    {
      id: projected.blocks[0].id,
      acp: projected.blocks[0].acp,
      tier: projected.blocks[0].tier,
      ref: projected.blocks[0].ref,
      topic: projected.blocks[0].topic,
      start: projected.blocks[0].start,
      end: projected.blocks[0].end,
      checkpointSeq: projected.blocks[0].checkpointSeq,
      status: projected.blocks[0].status,
      closed: projected.blocks[0].closed,
    },
    {
      id: compactionId,
      acp: true,
      tier: 1,
      ref: 'b-smoke',
      topic: 'host smoke',
      start: assistant.seq,
      end: assistant.seq,
      checkpointSeq: checkpoint.seq,
      status: 'resident',
      closed: true,
    },
  );

  await handle.dispose();
  const afterDispose = projections.snapshot(session, [KEY]);
  assert.equal(afterDispose.asOfSeq, session.seq - 1);
  assert.deepEqual(afterDispose.values, {}, 'disposing the handle should remove its wire key from snapshots');

  console.log(JSON.stringify({
    ok: true,
    dshInstallDir: installDir,
    projectionKey: KEY,
    sessionEvents: session.seq,
    asOfSeq: snapshot.asOfSeq,
    usage: projected.samples[0],
    compaction: projected.blocks[0],
    disposedKeyAbsent: !Object.hasOwn(afterDispose.values, KEY),
  }, null, 2));
} finally {
  // Safe to call even after the explicit assertion above; disposal is idempotent.
  await handle.dispose();
}
