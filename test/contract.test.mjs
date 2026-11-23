import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { definition, apply, stateSchema } from '../index.js';
import { initialState, fold } from '../model.js';
const root = new URL('../', import.meta.url);

test('host registers one read-only replayable projection without Kiva services', async () => {
  const registrations = [];
  await apply({ sessionProjections: { async register(value) { registrations.push(value); } } });
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0], definition);
  assert.equal(definition.wire.summary, false);
  const state = initialState();
  assert.equal(definition.wire.view(state), state);
  assert.deepEqual(stateSchema.parse(state), state);
});

test('strict checkpoint schema rejects corrupt state and accepts all reducer variants', () => {
  assert.throws(() => stateSchema.parse({ ...initialState(), samples: 'corrupt' }));
  assert.throws(() => stateSchema.parse({ ...initialState(), unexpected: true }));
  const events = [
    { type:'request/context',seq:1,time:1,data:{provider:'fake',model:'offline',contextWindow:10000} },
    { type:'assistant/message',seq:2,time:2,data:{turn:0,step:0,usage:{inputTokens:100,cacheReadTokens:900,outputTokens:20}} },
    { type:'compaction/summary',seq:3,time:3,data:{compactionId:'test',shadowedRange:{start:100,end:20},shadowedSeqs:[100,20],shadowedTokenCount:700,summary:[{type:'text',text:'summary'}],rawOutput:[{type:'text',text:JSON.stringify({$dshAcpBlockLedger:1,tier:1,kernelBlockId:'b1'})}]} },
    { type:'user/message',seq:4,time:4,data:{source:{kind:'compact-checkpoint',compactionId:'test'}},surfaceOp:{op:'replace',startSeq:100,endSeq:20},sourceEventSeqs:[100,20] },
    { type:'compaction/end',seq:5,time:5,data:{compactionId:'test',turn:0} },
  ];
  let state = initialState();
  for (const event of events) { state = fold(state,event); assert.deepEqual(stateSchema.parse(state),state); }
  assert.deepEqual(events.reduce(fold,initialState()),state);
  assert.equal(state.blocks[0].status,'resident');
  assert.equal(state.blocks[0].closed,true);
  assert.equal(JSON.stringify(state).includes('"text":"summary"'),false);
});

test('manifest exports runtime resources and scopes ACP to the four Web presets', () => {
  const manifest = JSON.parse(readFileSync(new URL('package.json',root),'utf8'));
  for (const path of ['index.js','model.js','client.js','icon.svg','README.md','LICENSE','locale/zh.json','locale/en.json','cordis.patch.yml']) assert.ok(existsSync(new URL(path,root)),path);
  assert.equal(manifest.name,'dsh-context-monitor');
  assert.equal(manifest.dsh.client.immediately,true);
  assert.equal(manifest.scripts.prepare,undefined);
  assert.equal(manifest.dependencies['billion-context-dsh'],undefined);
  const patch = readFileSync(new URL('cordis.patch.yml',root),'utf8');
  assert.match(patch,/id: local-context-monitor/);
  for(const id of ['standard','ptc','minimal','cordis']) {
    assert.match(patch,new RegExp(`^\u002d id: preset-${id}$`,'m'));
    assert.equal(patch.split(`- id: context-monitor-acp-${id}`).length,2);
  }
  assert.doesNotMatch(patch,/- id: (?:command-compact|compaction-basic)\s*$/m);
  assert.match(manifest.exports['./acp'],/acp\/host\.js$/);
  assert.match(manifest.exports['./acp/preset'],/acp\/preset\.js$/);
});

test('client lazy module registers only with host ModuleLoader, no module side effects', () => {
  const source=readFileSync(new URL('client.js',root),'utf8');
  let declaration;
  new vm.Script(source).runInNewContext({window:{__ModuleLoader__:{load(value){declaration=value;}}}});
  assert.equal(declaration.id,'dsh-context-monitor');
  assert.equal(typeof declaration.factory,'function');
  // Do not instantiate the React factory or emulate a DOM to fake a visual test.
  assert.doesNotMatch(source,/require\(['"]@deepseek-ai\//);
  assert.doesNotMatch(source,/document\.body|setInterval\(|fetch\(/);
  assert.match(source,/props\.useProjection\('contextPressure'\)/);
  assert.match(source,/contextMonitorAcp\/sessionStatus/);
});

test('icon is self-contained original SVG and locale display metadata exists', () => {
  const svg=readFileSync(new URL('icon.svg',root),'utf8');
  assert.match(svg,/<svg[^>]*width="36"[^>]*height="36"/);
  assert.doesNotMatch(svg,/<script|<image|<foreignObject|\bon\w+=/i);
  for(const lang of ['zh','en']){
    const locale=JSON.parse(readFileSync(new URL(`locale/${lang}.json`,root),'utf8'));
    assert.ok(locale.meta.title.length>0);assert.ok(locale.meta.description.length>0);
  }
});
