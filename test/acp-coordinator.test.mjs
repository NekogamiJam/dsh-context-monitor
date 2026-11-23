import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AcpCoordinator } from '../acp/coordinator.js';
import { ACP_PRESETS, parseAcpConfig, presetOf } from '../acp/config.js';

function makeScope(c, injectFailure) {
  return {
    mounted:0,
    async mount(config,token) {
      assert.equal(this.mounted,0,'never two backends in one scope');
      if(injectFailure?.(config))throw new Error('fixture mount rejection');
      this.mounted++;this.token=token;this.runtime=c.runtime(token,config.enabled,config);this.mode=config.enabled;
    },
    async unmount(){if(this.token)this.token.released=true;this.mounted=0;},
  };
}

test('balanced defaults and exact five presets, custom, incorrect ordering and hidden threshold overrides',()=>{
  assert.deepEqual(Object.values(ACP_PRESETS).map(Object.values),[[.55,.78,.93],[.50,.75,.90],[.45,.70,.85],[.40,.60,.78],[.30,.50,.70]]);
  assert.equal(parseAcpConfig({}).enabled,true);
  assert.equal(presetOf(parseAcpConfig({})),'balanced');
  assert.equal(presetOf(parseAcpConfig({...ACP_PRESETS.aggressive})), 'aggressive');
  assert.equal(presetOf(parseAcpConfig({nudgeMinContextLimitPct:.27})), 'custom');
  assert.throws(()=>parseAcpConfig({nudgeMinContextLimitPct:.9}), /Require min/);
  assert.throws(()=>parseAcpConfig({coreOverrides:{nudge:{minContextLimitPct:.02}}}), /three main threshold/);
  assert.throws(()=>parseAcpConfig({autoNudge:1}));
  assert.throws(()=>parseAcpConfig({maxOverflowRetries:-1}));
});

test('coordinator waits for all scopes, drains existing operations, and gates stale backend handles',async()=>{
  const c=new AcpCoordinator({required:['a','b']});
  const a=makeScope(c),b=makeScope(c);
  c.attach('a',a);
  await c.idle();assert.equal(c.status().phase,'blocked');assert.equal(a.mode,false);
  c.attach('b',b);
  await c.idle();assert.equal(c.status().phase,'on');assert.equal(a.mode,true);assert.equal(b.mode,true);
  let release;
  const previous=a.runtime;
  const op=previous.runOperation('compress',async()=>{
    await new Promise(resolve=>{release=resolve;});
    assert.equal(previous.runOperation('compress',()=>7),7,'existing operation may finish nested calls');
  });
  const switching=c.request({enabled:false});
  await setImmediate();
  assert.equal(c.status().phase,'switching');
  assert.equal(previous.runOperation('nudge',()=>assert.fail()),null);
  assert.throws(()=>previous.runOperation('compress',()=>assert.fail()),/暂不可用/);
  assert.equal(a.mode,true);assert.equal(b.mode,true);
  let finishCleanup;
  const cleanup=previous.runOperation('cleanup',()=>new Promise(resolve=>{finishCleanup=resolve;}));
  release();await op;
  assert.equal(c.status().phase,'switching','pair cleanup can finish after new writes close');
  assert.equal(c.status().configApplied,false);
  finishCleanup();await cleanup;await switching;
  assert.equal(c.status().configApplied,true);
  assert.throws(()=>previous.runOperation('cleanup',()=>assert.fail()),/暂不可用/);
  assert.equal(c.status().phase,'off');assert.equal(a.mode,false);assert.equal(b.mode,false);
  assert.throws(()=>previous.runOperation('read',()=>assert.fail()),/暂不可用/);
  await c.dispose();
});

test('external conflict blocks new ACP, a failed mount rolls back the whole cohort',async()=>{
  let conflict='external-compaction';const errors=[];
  const c=new AcpCoordinator({required:['a','b'],block:()=>conflict,report:e=>errors.push(e)});
  const a=makeScope(c),b=makeScope(c,cfg=>cfg.enabled && cfg.maxOverflowRetries===99);
  c.attach('a',a);c.attach('b',b);await c.idle();assert.equal(c.status().reason,conflict);
  conflict=null;await c.recheck();assert.equal(c.status().phase,'on');
  await c.request({maxOverflowRetries:99});assert.equal(c.status().phase,'blocked');assert.equal(c.status().reason,'activation-failed');
  assert.equal(a.runtime.readConfig().maxOverflowRetries,1);assert.equal(b.runtime.readConfig().maxOverflowRetries,1);
  assert.equal(c.status().effectiveEnabled,true);assert.equal(errors.length,1);
  await c.dispose();
});

test('a conflict discovered while draining prevents ACP admission',async()=>{
  let blocker=null, releaseDrain, paused=false;
  const c=new AcpCoordinator({required:['a'],block:()=>blocker,drain:()=>paused?new Promise(resolve=>{releaseDrain=resolve;}):undefined});
  const a=makeScope(c);
  c.attach('a',a);await c.idle();
  await c.request({enabled:false});
  paused=true;
  const enable=c.request({enabled:true});
  await setImmediate();
  assert.equal(c.status().phase,'switching');
  blocker='external-compaction'; paused=false; releaseDrain();
  await enable;
  assert.equal(c.status().reason,blocker);
  assert.equal(c.status().effectiveEnabled,false);
  assert.equal(a.mode,false);
  await c.dispose();
});
