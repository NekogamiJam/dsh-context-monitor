import { AsyncLocalStorage } from 'node:async_hooks';
import { isDeepStrictEqual } from 'node:util';
import { parseAcpConfig } from './config.js';

export const MANAGED_PRESETS = Object.freeze(['standard','ptc','minimal','cordis']);
const AUTO = new Set(['nudge','overflow','pressure','prompt']);
const IDLE = Object.freeze({requestedEnabled:true,effectiveEnabled:false,phase:'switching',reason:null,revision:0});

/** One coordinator per Host profile. Mounted engines never receive a mutable config object. */
export class AcpCoordinator {
  #scopes = new Map();
  #ops = new Set();
  #lease = new AsyncLocalStorage();
  #tail = Promise.resolve();
  #requested = parseAcpConfig({});
  #applied = parseAcpConfig({enabled:false});
  #snapshot = IDLE;
  #closed = false;
  #admitting = false;
  #generation = 0;
  #block;
  #notify;
  #log;
  #required;
  #validate;
  #drain;

  constructor({block=()=>null, notify=()=>{}, report=()=>{}, validate=()=>{}, drain=()=>{}, required=MANAGED_PRESETS}={}) {
    this.#block=block; this.#notify=notify; this.#log=report; this.#validate=validate; this.#drain=drain; this.#required=required;
  }
  status() {
    return {...this.#snapshot,configApplied:this.#admitting && isDeepStrictEqual(this.#requested,this.#applied)};
  }
  config() { return structuredClone(this.#applied); }
  requested() { return structuredClone(this.#requested); }
  idle() { return this.#tail; }

  #publish(phase, reason=null, effective=this.#applied.enabled) {
    this.#snapshot = Object.freeze({requestedEnabled:this.#requested.enabled,effectiveEnabled:effective,phase,reason,revision:this.#snapshot.revision+1});
    this.#notify();
  }

  runtime(token, mode, config) {
    return Object.freeze({
      readConfig:()=>structuredClone(config),
      runOperation:(kind,task)=>this.run(token,mode,kind,task),
    });
  }
  run(token, mode, kind, task) {
    if (this.#lease.getStore()?.active && this.#lease.getStore().token===token) return task();
    const generationExists=token.generation===this.#generation && !token.released;
    if (kind==='prompt' && generationExists) return task(); // synchronous effect installation during mount
    if ((!this.#admitting && kind!=='cleanup') || !generationExists || mode !== this.#applied.enabled) {
      if (AUTO.has(kind)) return null;
      throw new Error('上下文压缩暂不可用：配置正在切换或本命令已停用。请重试。');
    }
    const lease={token,active:true};
    let settle;
    const pending=new Promise(resolve=>{settle=resolve;});
    this.#ops.add(pending); // register before task() (which can synchronously call back)
    const release=()=>{lease.active=false;this.#ops.delete(pending);settle();};
    try {
      const value=this.#lease.run(lease,task);
      if (value && typeof value.then==='function') return Promise.resolve(value).finally(release);
      release(); return value;
    } catch(error) { release(); throw error; }
  }

  attach(id, participant) {
    if (!this.#required.includes(id)) throw new Error(`Unexpected ACP preset: ${id}`);
    const rows=this.#scopes.get(id) ?? new Set();
    this.#scopes.set(id,rows);rows.add(participant);
    void this.recheck();
    return async()=>{
      if (!rows.delete(participant)) return;
      if (!rows.size) this.#scopes.delete(id);
      participant.closing=true;
      await this.recheck();
      await participant.unmount();
    };
  }
  request(next) { this.#requested=parseAcpConfig(next);return this.recheck(); }
  recheck() {
    if(this.#closed)return this.#tail;
    const next=this.#tail.then(()=>this.#apply());
    this.#tail=next.catch(error=>{
      this.#admitting=false;
      this.#log(error);
      this.#publish('blocked','activation-failed',false);
    });
    return this.#tail;
  }
  #plan(requested) {
    const expected=this.#required.every(id=>this.#scopes.get(id)?.size===1);
    const existing=[...this.#scopes.values()].flatMap(rows=>[...rows]).filter(p=>!p.closing);
    const reason=requested.enabled ? (this.#block() ?? (!expected ? 'unmanaged-preset' : null)) : null;
    return {expected,existing,reason,candidate:reason ? {...requested,enabled:false} : requested};
  }
  async #apply() {
    const requested=this.#requested;
    try {this.#validate(requested);}catch(error){
      this.#log(error);this.#publish('blocked','invalid-advanced-config');return;
    }
    let {existing,reason,candidate}=this.#plan(requested);
    if(this.#admitting && this.#snapshot.reason===reason && isDeepStrictEqual(candidate,this.#applied) && existing.every(p=>p.generation===this.#generation)) return;
    this.#admitting=false;
    this.#publish('switching');
    await this.#drain();
    while(this.#ops.size)await Promise.allSettled([...this.#ops]);
    if(this.#closed)return;
    ({existing,reason,candidate}=this.#plan(requested));
    const previous=this.#applied;
    try {
      await this.#replace(existing,candidate);
      this.#admitting=true;
      this.#publish(reason ? 'blocked' : candidate.enabled ? 'on' : 'off',reason);
    } catch(error) {
      this.#log(error);
      try {
        // Hardware/runtime failure is explicit; restore the prior complete cohort
        // only if the same conflict check still permits it.
        const plan=this.#plan(previous);
        await this.#replace(plan.existing,plan.candidate);
        this.#admitting=true;
        this.#publish('blocked','activation-failed');
      } catch(failure) {
        this.#log(failure);
        this.#applied={...previous,enabled:false};
        this.#publish('blocked','activation-failed',false);
      }
    }
  }
  async #replace(participants,config) {
    const generation=++this.#generation;
    // Dispose every old backend before mounting any new one. There is never
    // more than one provider or set of listeners in a compaction realm.
    const dispose=await Promise.allSettled(participants.map(p=>p.unmount()));
    if(dispose.some(p=>p.status==='rejected'))throw new Error('Could not dispose every compaction backend');
    const mounts=await Promise.allSettled(participants.map(p=>p.mount(config,{generation,released:false})));
    if(mounts.some(p=>p.status==='rejected')) {
      await Promise.allSettled(participants.map(p=>p.unmount()));
      throw mounts.find(p=>p.status==='rejected').reason;
    }
    for (const p of participants) p.generation=generation;
    this.#applied=config;
  }
  async dispose() {
    this.#closed=true;this.#admitting=false;
    await Promise.allSettled([...this.#ops,this.#tail]);
    await Promise.allSettled([...this.#scopes.values()].flatMap(rows=>[...rows]).map(p=>p.unmount()));
    this.#scopes.clear();
  }
}
