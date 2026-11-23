import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic';
import { ManualCompactionError } from '@deepseek-ai/dsh-compaction';

// rc.5 calls the private-by-TypeScript (not #private) compactPressure method
// directly on model changes. Guard it as well as normal pressure/overflow;
// admission gates must cover all of the stock work, including preflight/model I/O.
function guardedStock(runtime) {
  if (typeof BasicCompactionEngine.prototype.compactPressure!=='function') throw new Error('Unsupported stock compaction ABI');
  return class GuardedStock extends BasicCompactionEngine {
    compactIfNeeded(...args) {return runtime.runOperation('pressure',()=>super.compactIfNeeded(...args));}
    compactPressure(agent,header,signal,requireBelowThreshold) {
      const pending=runtime.runOperation('pressure',()=>super.compactPressure(agent,header,signal,requireBelowThreshold));
      if (pending===null && requireBelowThreshold) throw new Error('上下文压缩正在切换，暂不能更换模型');
      return pending;
    }
    compactRegion(...args) {return runtime.runOperation('compress',()=>super.compactRegion(...args));}
    compactNow(...args) {return runtime.runOperation('compress',()=>super.compactNow(...args));}
  };
}

const error=text=>({kind:'error',text});
const manualErrors=Object.freeze({
  busy:'Compaction is unavailable because this process has an active compaction, or the agent is not idle.',
  cancelled:'Compaction cancelled.',
  changed:'The history selected for compaction changed before it could be replaced. The attempt is recorded in the session log.',
  summary:'Compaction could not produce a useful summary. The attempt is recorded in the session log.',
  commit:'Compaction did not finish cleanly; some session history may have changed. Inspect the current session state before retrying.',
  persistence:'Compaction finished, but the session could not be saved.',
});

export const name='context-monitor-acp-preset';
export const inject=['contextMonitorAcp','commands'];
export function apply(ctx, config) {
  const state=ctx.contextMonitorAcp;
  const coordinator=state.c;
  let current;
  const participant={
    async mount(snapshot,token){
      const runtime={...coordinator.runtime(token,snapshot.enabled,snapshot),settingsCommand:state.settingsCommand()};
      const engine=snapshot.enabled ? (await import('./vendor/index.js')).AcpCompactionEngine : guardedStock(runtime);
      if(typeof engine!=='function')throw new Error('Compaction backend export is missing');
      if(ctx.get('compaction'))throw new Error('A different compaction engine already owns this realm');
      const fiber=ctx.plugin(engine,snapshot.enabled?{runtime}:config?.stock);
      current={token,fiber};
      try {
        await fiber;
        const service=ctx.get('compaction');
        if (!service || !(service instanceof engine)) throw new Error('Wrong compaction backend scope (already owned or not ready)');
        current.service=service;
        if(!snapshot.enabled)current.unregisterCompact=registerStockCommand(service);
      } catch(err){await participant.unmount();throw err;}
    },
    async unmount(){
      const old=current;
      if(old){
        current=undefined;
        old.token.released=true;
        try {await old.unregisterCompact?.();} finally {await old.fiber.dispose();}
      }
    },
  };
  ctx.effect(()=>coordinator.attach(config.preset,participant));
  ctx.on('agent/pre-step',(_payload,next)=>{
    // During the gap between disposing and mounting, don't fall through to
    // sending a provider request with neither pressure nor recovery policy.
    if(state.status().phase==='switching'||!current?.service)return {kind:'reject'};
    return next();
  },{prepend:true});
  // Stock alone owns this command. With ACP enabled the ordinary composer
  // may send the literal text, just as it does for any unregistered command.
  function registerStockCommand(service) {return ctx.commands.register({
    name:'compact',description:'Compact older conversation history',
    async handler(invocation){
      const status=state.status();
      if(status.effectiveEnabled||status.phase==='switching'||current?.service!==service)return error('上下文压缩正在切换或当前不可用，请稍后重试。');
      if(invocation.rawInput.trim())return error('Usage: /compact (no arguments)');
      try {
        const result=await service.compactNow(invocation.agent,invocation.signal,invocation.commandId);
        return result===null ? {kind:'success',text:'No compactable history yet.'} : {
          kind:'success',text:`Compacted ${result.shadowedSeqs.length} history items (~${result.shadowedTokenCount} tokens).`,sourceEventSeq:result.summarySeq,
        };
      }catch(err){
        if(invocation.signal.aborted)return error(manualErrors.cancelled);
        if(err instanceof ManualCompactionError && Object.hasOwn(manualErrors,err.code))return error(manualErrors[err.code]);
        throw err;
      }
    },
  });}
}
