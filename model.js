// Pure JSON projection. Never imports billion-context-dsh, opens a session, or changes requests.
export const KEY = 'localContextMonitor';
export const MAX_SAMPLES = 600;
export const MAX_BLOCKS = 400;
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const string = (value, max = 160) => typeof value === 'string' ? value.slice(0, max) : null;
export const initialState = () => ({ provider: null, model: null, contextWindow: null, samples: [], blocks: [], sampleCount: 0, blockCount: 0, droppedSamples: 0, droppedBlocks: 0, malformedLedgers: 0 });

export function readLedger(raw) {
  if (!Array.isArray(raw)) return null;
  for (const item of raw.slice(0, 32)) {
    if (item?.type !== 'text' || typeof item.text !== 'string' || item.text.length > 262144) continue;
    let data;
    try { data = JSON.parse(item.text); } catch { continue; }
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.hasOwn(data, '$dshAcpBlockLedger')) continue;
    if (data.$dshAcpBlockLedger !== 1) return { supported: false };
    return {
      supported: true,
      tier: [1, 2, 3].includes(data.tier) ? data.tier : null,
      kernelBlockId: string(data.kernelBlockId, 80), topic: string(data.topic, 240),
      parents: Array.isArray(data.parentBlockIds) ? data.parentBlockIds.filter(x => typeof x === 'string').slice(0, 256).map(x => x.slice(0, 160)) : [],
    };
  }
  return null;
}

export function usageSample(usage) {
  if (!usage || number(usage.inputTokens) === null) return null;
  const uncached = number(usage.inputTokens);
  const read = number(usage.cacheReadTokens);
  const write = number(usage.cacheWriteTokens);
  // DSH 0.2.2-rc.3 TokenUsage: these are disjoint normalized buckets.
  const input = uncached + (read ?? 0) + (write ?? 0);
  if (!Number.isFinite(input)) return null;
  return { input, uncached, read, write, output: number(usage.outputTokens), hit: read === null || input === 0 ? null : read / input };
}

export function fold(state, event) {
  const data = event?.data;
  if (!data || typeof data !== 'object') return state;
  switch (event.type) {
    case 'request/header': {
      const config = data.header?.config;
      if (!config) return state;
      const provider = string(config.provider), model = string(config.model);
      if (provider === state.provider && model === state.model) return state;
      return { ...state, provider, model, contextWindow: null };
    }
    case 'request/context': {
      const provider = string(data.provider), model = string(data.model), contextWindow = number(data.contextWindow);
      if (provider === state.provider && model === state.model && contextWindow === state.contextWindow) return state;
      return { ...state, provider, model, contextWindow };
    }
    case 'assistant/message': {
      const usage = usageSample(data.usage);
      if (!usage) return state;
      const turn = number(data.turn), step = number(data.step);
      const sample = { ...usage, seq: number(event.seq), time: number(event.time), turn, step, provider: state.provider, model: state.model, window: state.contextWindow };
      const previous = state.samples.at(-1);
      // A repeated assembled outcome for the same step replaces its visible sample.
      const same = previous && turn !== null && step !== null && previous.turn === turn && previous.step === step;
      const samples = same ? [...state.samples.slice(0, -1), sample] : [...state.samples, sample];
      const excess = Math.max(0, samples.length - MAX_SAMPLES);
      return { ...state, samples: samples.slice(-MAX_SAMPLES), sampleCount: state.sampleCount + (same ? 0 : 1), droppedSamples: state.droppedSamples + excess };
    }
    case 'compaction/summary': {
      const id = string(data.compactionId);
      if (!id) return state;
      if (state.blocks.some(block => block.id === id)) return state;
      const ledger = readLedger(data.rawOutput);
      const chars = Array.isArray(data.summary) ? data.summary.reduce((n, b) => n + (b?.type === 'text' && typeof b.text === 'string' ? b.text.length : 0), 0) : null;
      const block = {
        id, seq: number(event.seq), time: number(event.time),
        acp: ledger?.supported === true, ledgerUnsupported: ledger?.supported === false,
        tier: ledger?.tier ?? null, ref: ledger?.kernelBlockId ?? null, topic: ledger?.topic ?? null, parents: ledger?.parents ?? [],
        start: number(data.shadowedRange?.start), end: number(data.shadowedRange?.end),
        messages: Array.isArray(data.shadowedSeqs) ? data.shadowedSeqs.length : null,
        originalTokens: number(data.shadowedTokenCount), summaryTokensEstimate: chars === null ? null : Math.ceil(chars / 4),
        checkpointSeq: null, status: 'uncommitted', closed: false, error: false,
      };
      const blocks = [...state.blocks, block];
      const excess = Math.max(0, blocks.length - MAX_BLOCKS);
      return { ...state, blocks: blocks.slice(-MAX_BLOCKS), blockCount: state.blockCount + 1, droppedBlocks: state.droppedBlocks + excess, malformedLedgers: state.malformedLedgers + (ledger?.supported === false ? 1 : 0) };
    }
    case 'compaction/end': {
      const id = string(data.compactionId);
      let changed = false;
      const blocks = state.blocks.map(block => {
        if (block.id !== id || block.closed) return block;
        changed = true;
        return { ...block, closed: true, error: data.error !== undefined && data.error !== null };
      });
      return changed ? { ...state, blocks } : state;
    }
    case 'user/message':
    case 'tool/result': {
      if (event.surfaceOp?.op !== 'replace') return state;
      const source = event.type === 'user/message' ? data.source : data.message?.source;
      const id = source?.kind === 'compact-checkpoint' || (source?.kind === 'plugin' && source?.plugin === 'compact') ? string(source.compactionId) : null;
      const nextBlock = id ? state.blocks.find(block => block.id === id) : undefined;
      const exact = Array.isArray(event.sourceEventSeqs) ? new Set(event.sourceEventSeqs) : null;
      let changed = false;
      const blocks = state.blocks.map(block => {
        if (id && block.id === id) { changed = true; return { ...block, checkpointSeq: number(event.seq), status: 'resident' }; }
        // Parent IDs in billion-context-dsh v1 ledger are durable compaction IDs, not bili seqs.
        if (block.status === 'resident' && (nextBlock?.parents.includes(block.id) || (exact && exact.has(block.checkpointSeq)))) {
          changed = true; return { ...block, status: 'folded' };
        }
        // Without exact provenance do not pretend numeric seq order is surface order.
        if (block.status === 'resident' && !exact && !nextBlock) { changed = true; return { ...block, status: 'unknown' }; }
        return block;
      });
      return changed ? { ...state, blocks } : state;
    }
    default: return state;
  }
}
