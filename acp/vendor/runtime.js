export function readInitialRuntimeConfig(runtime) {
  const snapshot = runtime.readConfig();
  if (snapshot === null || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new TypeError('AcpCompactionEngine runtime.readConfig() must return a configuration object');
  }
  const { runtime: _nestedRuntime, ...effective } = snapshot;
  return effective;
}

export function surfaceSeqBounds(nodes) {
  if (nodes.length === 0) return null;
  let start = nodes[0];
  let end = nodes[0];
  for (let index = 1; index < nodes.length; index += 1) {
    const seq = nodes[index];
    if (seq < start) start = seq;
    if (seq > end) end = seq;
  }
  return { start, end };
}

export const OPERATION_KINDS = Object.freeze(['nudge', 'overflow', 'compress', 'read', 'settings', 'prompt', 'cleanup']);

export function validateRecognizedAcpLedgerEntry(event, index, events, knownCompactionIds, knownKernelBlockIds) {
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const item = isRecord(event) ? event : {};
  if (item.type !== 'compaction/summary') return;
  const data = isRecord(item.data) ? item.data : {};
  const compactionId = typeof data.compactionId === 'string' && data.compactionId.length > 0 ? data.compactionId : `event-${index}`;
  let ledger;
  if (Array.isArray(data.rawOutput)) {
    for (const block of data.rawOutput) {
      if (!isRecord(block) || block.type !== 'text' || typeof block.text !== 'string') continue;
      let parsed;
      try { parsed = JSON.parse(block.text); } catch { continue; }
      if (isRecord(parsed) && parsed.$dshAcpBlockLedger === 1) { ledger = parsed; break; }
    }
  }
  if (ledger === undefined) {
    if (typeof data.compactionId === 'string' && data.compactionId.length > 0) knownCompactionIds.add(data.compactionId);
    return;
  }
  const fail = reason => { throw new Error(`ACP ledger v1 recovery rejected compaction ${compactionId}: ${reason}; repair or restore the session ledger before sending a provider request`); };
  if (typeof data.compactionId !== 'string' || data.compactionId.length === 0) fail('compactionId is missing');
  if (knownCompactionIds.has(data.compactionId)) fail(`duplicate compactionId ${data.compactionId}`);
  const seqs = data.shadowedSeqs;
  if (!Array.isArray(seqs) || seqs.length === 0 || !seqs.every(seq => Number.isInteger(seq) && seq >= 0 && seq < index && events[seq] !== undefined)) {
    fail('shadowedSeqs is missing an original event or contains an invalid seq');
  }
  const range = isRecord(data.shadowedRange) ? data.shadowedRange : undefined;
  if (range === undefined || !Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start > range.end) {
    fail('shadowedRange provenance is missing or invalid');
  }
  if (typeof ledger.kernelBlockId !== 'string' || !/^b\d+$/.test(ledger.kernelBlockId)) fail('kernelBlockId provenance is missing or invalid');
  if (knownKernelBlockIds.has(ledger.kernelBlockId)) fail(`duplicate kernelBlockId ${ledger.kernelBlockId}`);
  const tier = ledger.tier ?? (data.tier === 2 || data.tier === 3 ? data.tier : 1);
  if (tier !== 1 && tier !== 2 && tier !== 3) fail('tier is invalid');
  const stringArray = (value, allowEmpty = false) => Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(id => typeof id === 'string' && id.length > 0);
  const directIdsValid = tier === 1 ? stringArray(ledger.directMessageIds) : ledger.directMessageIds === undefined || stringArray(ledger.directMessageIds, true);
  if (!directIdsValid || !stringArray(ledger.effectiveMessageIds)) fail('direct/effective message provenance is missing or invalid');
  if (tier > 1) {
    if (!stringArray(ledger.parentBlockIds)) fail(`tier ${tier} parentBlockIds are missing or invalid`);
    for (const parent of ledger.parentBlockIds) {
      if (!knownCompactionIds.has(parent)) fail(`tier ${tier} parent ${parent} is not present earlier in the ledger`);
    }
  } else if (ledger.parentBlockIds !== undefined && (!Array.isArray(ledger.parentBlockIds) || !ledger.parentBlockIds.every(id => typeof id === 'string'))) {
    fail('parentBlockIds are invalid');
  }
  knownCompactionIds.add(data.compactionId);
  knownKernelBlockIds.add(ledger.kernelBlockId);
}

export function isAcpRuntime(value) {
  if (value === null || typeof value !== 'object') return false;
  return typeof value.readConfig === 'function'
    && typeof value.runOperation === 'function'
    && (value.settingsCommand === undefined || (value.settingsCommand !== null && typeof value.settingsCommand === 'object'));
}

export function assertAcpRuntime(value) {
  if (!isAcpRuntime(value)) {
    throw new TypeError('AcpCompactionEngine runtime must provide readConfig() and runOperation(kind, fn)');
  }
}

/** Manual/read actions must never silently fall back when their generation is unavailable. */
export async function runRequiredOperation(runtime, kind, fn) {
  const result = runtime === undefined ? await fn() : await runtime.runOperation(kind, fn);
  if (result === null) throw new Error(`ACP ${kind} operation is unavailable (generation is not accepting work)`);
  return result;
}
