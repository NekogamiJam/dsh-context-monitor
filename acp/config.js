import { z } from 'zod';

export const NUDGE_KEYS = ['nudgeMinContextLimitPct', 'nudgeMaxContextLimitPct', 'nudgeEmergencyThresholdPct'];
export const ACP_PRESETS = Object.freeze(Object.fromEntries(Object.entries({
  preserve: [0.55, 0.78, 0.93], relaxed: [0.50, 0.75, 0.90], balanced: [0.45, 0.70, 0.85],
  efficient: [0.40, 0.60, 0.78], aggressive: [0.30, 0.50, 0.70],
}).map(([key, values]) => [key, Object.freeze(Object.fromEntries(NUDGE_KEYS.map((name, i) => [name, values[i]])))])));

const percent = key => z.number().min(0).max(1).default(ACP_PRESETS.balanced[key]);
const smallJson = z.json().refine(value => JSON.stringify(value).length <= 64_000, 'Advanced setting exceeds 64 KiB');
const object = z.record(z.string().refine(key => !['__proto__', 'prototype', 'constructor'].includes(key)), smallJson);
const fields = {
  enabled: z.boolean().default(true),
  nudgeMinContextLimitPct: percent(NUDGE_KEYS[0]), nudgeMaxContextLimitPct: percent(NUDGE_KEYS[1]),
  nudgeEmergencyThresholdPct: percent(NUDGE_KEYS[2]),
  autoModelContextLimit: z.boolean().default(true), modelContextLimit: z.number().int().positive().optional(),
  maxOverflowRetries: z.number().int().nonnegative().default(1), autoNudge: z.boolean().default(true),
  autoTools: z.boolean().default(true), autoCommand: z.boolean().default(true),
  coreOverrides: object.optional(), prompts: object.optional(),
};
export const acpConfigSchema = z.strictObject(fields).superRefine((config, ctx) => {
  const [min, max, emergency] = NUDGE_KEYS.map(key => config[key]);
  if (min > max || max > emergency) ctx.addIssue({code:'custom', path:[NUDGE_KEYS[1]], message:'Require min ≤ max ≤ emergency'});
  // Declared thresholds have exactly one source of truth, not a hidden override.
  const hidden = config.coreOverrides?.nudge;
  if (hidden && typeof hidden === 'object' && ['minContextLimitPct','maxContextLimitPct','emergencyThresholdPct'].some(key=>Object.hasOwn(hidden,key))) {
    ctx.addIssue({code:'custom', path:['coreOverrides','nudge'], message:'Use the three main threshold fields instead'});
  }
});

export function parseAcpConfig(value) {
  return acpConfigSchema.parse(value ?? {});
}

export function presetOf(config) {
  return Object.entries(ACP_PRESETS).find(([, values]) => NUDGE_KEYS.every(key => config[key] === values[key]))?.[0] ?? 'custom';
}

// Schemastery preserves one volatile reference for the whole object, avoiding
// inconsistent intermediate values during a preset change. The Host revalidates
// the exact value before admission (the UI is not trusted).
export function makeHostConfig(z) {
  const acp = z.transform(z.any(), function validate(value) {
    const defaults = {enabled:true,nudgeMinContextLimitPct:.45,nudgeMaxContextLimitPct:.70,nudgeEmergencyThresholdPct:.85,
      autoModelContextLimit:true,maxOverflowRetries:1,autoNudge:true,autoTools:true,autoCommand:true};
    const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
    if (!obj(value)) throw new Error('ACP settings must be an object');
    const extra=['modelContextLimit','coreOverrides','prompts'];
    for (const key of Object.keys(value)) if (!Object.hasOwn(defaults,key) && !extra.includes(key)) throw new Error(`Unknown ACP setting: ${key}`);
    const out = {...defaults,...value};
    for (const key of ['enabled','autoModelContextLimit','autoNudge','autoTools','autoCommand']) {
      if (typeof out[key] !== 'boolean') throw new Error(`${key} must be a boolean`);
    }
    const [min,max,emergency]=[out.nudgeMinContextLimitPct,out.nudgeMaxContextLimitPct,out.nudgeEmergencyThresholdPct];
    if (![min,max,emergency].every(Number.isFinite) || min<0 || min>max || max>emergency || emergency>1) throw new Error('Require 0 ≤ min ≤ max ≤ emergency ≤ 1');
    for (const key of ['maxOverflowRetries','modelContextLimit']) {
      const n=out[key];
      if (key==='modelContextLimit' && n===undefined)continue;
      if (!Number.isSafeInteger(n) || n<(key==='modelContextLimit'?1:0))throw new Error(`Invalid ${key}`);
    }
    for (const key of ['coreOverrides','prompts']) {
      if (out[key]===undefined) continue;
      const safe = (v,depth=0) => depth < 32 && (v===null || typeof v==='string' || typeof v==='boolean' || Number.isFinite(v)
        || (Array.isArray(v) && v.every(x=>safe(x,depth+1)))
        || (obj(v) && Object.entries(v).every(([k,x])=>!['__proto__','prototype','constructor'].includes(k)&&safe(x,depth+1))));
      if (!obj(out[key]) || !safe(out[key]) || JSON.stringify(out[key]).length>64000) throw new Error(`Invalid ${key}`);
    }
    const nudge=out.coreOverrides?.nudge;
    if (obj(nudge) && ['minContextLimitPct','maxContextLimitPct','emergencyThresholdPct'].some(key=>Object.hasOwn(nudge,key))) throw new Error('Use the three main threshold fields instead');
    return out;
  }).default({}).volatile();
  // rc.5's browser rehydrates the editable leaf; do not export executable
  // transform source to a CSP-restricted client. Host checks the real leaf.
  const wire = z.any().default({}).volatile();
  Object.defineProperty(acp,'toJSON',{value:()=>wire.toJSON()});
  return z.object({acp});
}
