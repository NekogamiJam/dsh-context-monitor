import { z } from 'zod';
import { KEY, MAX_SAMPLES, MAX_BLOCKS, initialState, fold } from './model.js';
export const name = 'local-context-monitor';
export const inject = ['sessionProjections'];
const n = () => z.number().finite().nonnegative().nullable();
const s = () => z.string().nullable();
const sample = z.object({ input: z.number().nonnegative(), uncached: z.number().nonnegative(), read: n(), write: n(), output: n(), hit: n(), seq: n(), time: n(), turn: n(), step: n(), provider: s(), model: s(), window: n() }).strict();
const block = z.object({ id: z.string(), seq: n(), time: n(), acp: z.boolean(), ledgerUnsupported: z.boolean(), tier: n(), ref: s(), topic: s(), parents: z.array(z.string()).max(256), start: n(), end: n(), messages: n(), originalTokens: n(), summaryTokensEstimate: n(), checkpointSeq: n(), status: z.enum(['uncommitted', 'resident', 'folded', 'unknown']), closed: z.boolean(), error: z.boolean() }).strict();
export const stateSchema = z.object({ provider: s(), model: s(), contextWindow: n(), samples: z.array(sample).max(MAX_SAMPLES), blocks: z.array(block).max(MAX_BLOCKS), sampleCount: z.number().int().nonnegative(), blockCount: z.number().int().nonnegative(), droppedSamples: z.number().int().nonnegative(), droppedBlocks: z.number().int().nonnegative(), malformedLedgers: z.number().int().nonnegative() }).strict();
export const definition = { key: KEY, stateVersion: 1, stateSchema, init: initialState, apply: fold, wire: { viewSchema: stateSchema, view: state => state, summary: false } };
export async function apply(ctx) {
  // Registration, replay, cache lifetime and publication belong to the host.
  // There is deliberately no billion-context-dsh import, request hook, session write or timer.
  await ctx.sessionProjections.register(definition);
}
