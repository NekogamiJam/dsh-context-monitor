import { isDeepStrictEqual } from 'node:util';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info';
import z from '@deepseek-ai/schemastery';
import { z as wire } from 'zod';
import { AcpCoordinator, MANAGED_PRESETS } from './coordinator.js';
import { makeHostConfig, parseAcpConfig } from './config.js';
import { AcpCompactionEngine, validateAdvancedConfig } from './vendor/index.js';
import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic';

const NS='context-monitor-acp';
const PHASES=['off','on','switching','blocked'];
const statusSchema=wire.strictObject({requestedEnabled:wire.boolean(),effectiveEnabled:wire.boolean(),configApplied:wire.boolean(),phase:wire.enum(PHASES),reason:wire.string().nullable(),revision:wire.number().int().nonnegative()});
const sessionStatusSchema=wire.strictObject({backend:wire.enum(['builtin','stock','external','switching','none','unknown']),unmanaged:wire.boolean()});
const sessionIdCodec={mode:'strict',typeSymbol:'SessionId',create:()=>wire.string().min(1).max(160)};
const remoteInfo=createTypertRemoteInfo({package:'dsh-context-monitor/acp',methods:{
  'contextMonitorAcp/status':{service:'contextMonitorAcp',invocation:{kind:'direct'},parameters:[],result:{mode:'strict',typeSymbol:'dsh-context-monitor/acp#AcpStatus',create:()=>statusSchema}},
  'contextMonitorAcp/sessionStatus':{service:'contextMonitorAcp',invocation:{kind:'direct'},parameters:[{name:'sessionId',source:'json',codec:sessionIdCodec,strictCodec:sessionIdCodec}],result:{mode:'strict',typeSymbol:'dsh-context-monitor/acp#SessionAcpStatus',create:()=>sessionStatusSchema}},
}},wire);
const contribution={package:'dsh-context-monitor/acp',face:'host',model:{services:[],events:[],objects:[]},schemas:[],invocations:remoteInfo.descriptors};
const seenModule=name => typeof name==='string' && (name==='billion-context-dsh' || name.startsWith('billion-context-dsh/') || name==='billion-context' || name.startsWith('billion-context/') || /^(?:dsh-(?:context-fold|smart-compact|compaction-(?:tower|instant|selective)))(?:\/|$)/.test(name));

function conflict(ctx) {
  if (ctx.get('compaction')) return 'external-compaction'; // Web built-ins are isolate-local.
  const loader=ctx.get('loader');
  if (!loader) return 'loader-unavailable';
  if ([...loader.entries()].some(row=>!row.disabled && seenModule(row.options.name))) return 'external-compaction';
  // `inspectCompositions` includes retained preset revisions. Never edit or
  // forcibly migrate them; a retained unmanaged revision blocks activation.
  for (const revision of ctx.get('agentPresets')?.inspectCompositions() ?? []) {
    if (!MANAGED_PRESETS.includes(revision.id)) return 'unmanaged-preset';
    const modules=revision.modules.map(row=>row.moduleName);
    if (modules.some(seenModule)) return 'external-compaction';
    if (!modules.includes('dsh-context-monitor/acp/preset') || modules.includes('@deepseek-ai/dsh-compaction-basic')) return 'unmanaged-preset';
  }
  return null;
}

let markStatus, markSessionStatus;
export class ContextMonitorAcp extends TypertRemoteService {
  static inject=['loader','typert'];
  static Config=makeHostConfig(z);
  constructor(ctx, config) {
    super(ctx,'contextMonitorAcp');
    this.c=new AcpCoordinator({
      block:()=>conflict(ctx),notify:()=>ctx.emit('commands/change'),validate:validateAdvancedConfig,
      drain:()=>Promise.allSettled((ctx.get('agents')?.list()??[]).filter(agent=>agent.status!=='idle').map(agent=>agent.whenIdle())),
      report:error=>{this.diagnostic=error;ctx.logger.warn('context-monitor ACP scope failed; check the effective profile and preset composition');},
    });
    markStatus.call(this);
    markSessionStatus.call(this);
    ctx.effect(()=>ctx.typert.register(contribution));
    const apply=()=>{
      const next=parseAcpConfig(config.acp?.get?.() ?? config.acp);
      if (!isDeepStrictEqual(this.c.requested(),next)) void this.c.request(next);
    };
    this.syncConfig=apply;
    ctx.on('loader/volatile-update',apply);
    // The settings namespace is also useful when Config's optional services
    // came up later in this composition.
    ctx.on('settings/document-updated',id=>{if(id===NS)apply();});
    // Loading/unloading independent backends invalidates the admission decision.
    ctx.on('internal/service',name=>{if(name==='compaction' || name==='agentPresets')void this.c.recheck();});
    ctx.effect(()=>()=>this.c.dispose());
    apply();
    void this.c.recheck();
  }
  status() {this.syncConfig();return statusSchema.parse(this.c.status());}
  sessionStatus(sessionId) {
    // Read the live Agent only; never resume a historical session just to render its tab.
    const agent=this.ctx.get('agents')?.get(sessionId);
    if (!agent) return {backend:'unknown',unmanaged:false};
    const presets=agent.ctx.get('agentPresets') ?? this.ctx.get('agentPresets');
    const revisions=presets?.inspectCompositions(agent.ctx) ?? [];
    const managed=revisions.some(row=>MANAGED_PRESETS.includes(row.id) && row.modules.some(mod=>mod.moduleName==='dsh-context-monitor/acp/preset'));
    const scoped=presets?.serviceFor(agent,'compaction');
    const engine=scoped ?? agent.ctx.get('compaction');
    const phase=this.c.status().phase;
    const backend=managed && phase==='switching' ? 'switching'
      : engine instanceof AcpCompactionEngine ? 'builtin'
      : engine instanceof BasicCompactionEngine ? 'stock'
      : engine ? 'external' : 'none';
    return {backend,unmanaged:!managed};
  }
  settingsCommand() {
    const svc=this;
    const settings=()=>svc.ctx.get('settings');
    const desc=()=>settings()?.describe().find(row=>String(row.ns)===NS);
    const write=async incoming=>{
      const form=desc();
      if (!form || !settings()) throw new Error('找不到上下文监控的 profile 设置');
      const next=parseAcpConfig(incoming);
      validateAdvancedConfig(next);
      await settings().mutate(NS,[{op:'set',path:['acp'],value:next}],form.revision);
    };
    return {
      get available(){return !!desc();},
      snapshot:()=>svc.c.requested(),
      describe:()=>{
        const row=desc();return row && {...row,user:row.user?.acp,base:row.base?.acp};
      },
      update:patch=>write({...svc.c.requested(),...patch}),
      replaceSection:section=>write({...svc.c.requested(),modelContextLimit:undefined,autoModelContextLimit:undefined,nudgeMinContextLimitPct:undefined,nudgeMaxContextLimitPct:undefined,nudgeEmergencyThresholdPct:undefined,autoNudge:undefined,...section}),
    };
  }
}
Remote(ContextMonitorAcp.prototype.status,{kind:'method',name:'status',private:false,static:false,addInitializer(fn){markStatus=fn;}});
Remote({resources:{session:sessionId=>sessionId}})(ContextMonitorAcp.prototype.sessionStatus,{kind:'method',name:'sessionStatus',private:false,static:false,addInitializer(fn){markSessionStatus=fn;}});
export default ContextMonitorAcp;
