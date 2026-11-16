import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../client.js',import.meta.url),'utf8');
const start=source.indexOf('async function checkInventory(){');
const end=source.indexOf('function Monitor(',start);
const detector=new Function('ctx',source.slice(start,end)+';return checkInventory;');
const detect=service=>detector({get(key){assert.equal(key,'remote.pluginInventory');return service;}})();
test('inventory active is based on a live exact-name enabled active row',async()=>{
 assert.deepEqual(await detect({async list(){return {ok:true,value:{entries:[{moduleName:'billion-context-dsh',enabled:true,fiberPhase:'active'}]}}}}),{status:'active',reason:null});
});
test('detector resolves service per request including late registration',async()=>{
 let service;const check=detector({get(){return service;}});
 assert.deepEqual(await check(),{status:'unknown',reason:'unavailable'});
 service={async list(){return {ok:true,value:{entries:[{moduleName:'billion-context-dsh',enabled:true,fiberPhase:'active'}]}}}};
 assert.equal((await check()).status,'active');
});
test('missing, disabled, failed and lookalike modules cannot claim active',async()=>{
 for(const entries of [[],[{moduleName:'billion-context-dsh-other',enabled:true,fiberPhase:'active'}],[{moduleName:'billion-context-dsh',enabled:false,fiberPhase:'active'}],[{moduleName:'billion-context-dsh',enabled:true,fiberPhase:'failed'}]])assert.equal((await detect({async list(){return {ok:true,value:{entries}}}})).status,'absent');
});
test('unknown carries explicit unavailable, denial, malformed or request failure reason',async()=>{
 assert.equal((await detect(null)).reason,'unavailable');
 assert.deepEqual(await detect({async list(){return {ok:false,error:{code:'FORBIDDEN'}}}}),{status:'unknown',reason:'denied',code:'FORBIDDEN'});
 assert.equal((await detect({async list(){return {ok:true,value:{}}}})).reason,'invalidResponse');
 assert.equal((await detect({async list(){throw Error('private detail')}})).reason,'requestFailed');
});
test('visible module naming uses package name rather than author name',()=>{
 assert.doesNotMatch(source,/Kiva/);
 assert.match(source,/billion-context-dsh 状态未知/);
});
