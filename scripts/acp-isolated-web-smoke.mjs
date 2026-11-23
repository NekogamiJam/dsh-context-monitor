#!/usr/bin/env node
// Opt-in isolated integration fixture. Never run against a production home.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';

const fixture=resolve('artifacts/rc5-fake-provider-host');
const nodeModules=join(fixture,'node_modules');
const caseId=process.env.DCM_SMOKE_CASE ?? '';
assert.match(caseId,/^[a-zA-Z0-9-]{0,80}$/);
const testRun=caseId?join(fixture,'cases',caseId):fixture;
const home=join(testRun,'home');
assert.equal(resolve(process.env.DSH_HOME??''),home,'Use the isolated test home, not a Desktop profile');
assert.equal(process.env.DSH_TELEMETRY_DISABLED,'1');
const noProviders=resolve('scripts/acp-isolated-no-providers.yml');
const workspace=join(testRun,'workspace');
mkdirSync(workspace,{recursive:true});
process.chdir(workspace);
const load=file=>import(pathToFileURL(file).href);
const dsh=join(nodeModules,'@deepseek-ai','dsh','lib');
const req=createRequire(join(dsh,'bin.js'));
const {loadLayeredEnv}=await load(req.resolve('@deepseek-ai/dsh-app-boot'));
const {runProfile}=await load(join(dsh,'profile-boot.js'));
const {ctx}=await runProfile({environment:loadLayeredEnv('dsh'),profile:'web',patchFiles:[noProviders],args:['--host','127.0.0.1','--no-open','--port','0']});
const captures=[];
const mock=createServer(async(req,res)=>{
  try {
    assert.equal(req.method,'POST');assert.equal(req.url,'/inference');
    const chunks=[];let size=0;
    for await (const b of req){size+=b.length;if(size>2_000_000)throw new Error('Fixture payload too large');chunks.push(b);}
    captures.push(JSON.parse(Buffer.concat(chunks)));
    res.setHeader('content-type','application/json');res.end(JSON.stringify({text:'Fixture response'}));
  } catch {res.writeHead(400).end();}
});
mock.listen(0,'127.0.0.1');await once(mock,'listening');
const endpoint=`http://127.0.0.1:${mock.address().port}/inference`;
try {
  assert.deepEqual(ctx.llm.listProviders(),[],'no real model adapters are available in the test profile');
  const acp=ctx.get('contextMonitorAcp');
  assert.ok(acp,'package boot must activate the profile controller');
  await acp.c.idle();
  console.log('initial',acp.status(),acp.diagnostic?.stack);
  console.log('presets',ctx.agentPresets.inspectCompositions().map(r=>({id:r.id,rows:r.modules.filter(x=>x.moduleName.includes('compaction')||x.moduleName.includes('context-monitor')).map(x=>x.moduleName),leaked:r.leakedServices})));
  const form=()=>ctx.settings.describe().find(row=>row.ns==='context-monitor-acp');
  assert.ok(form(),'real settings form exposed');
  const callStatus=()=>ctx.typertGateway.invoke({namespace:'contextMonitorAcp',method:'status',args:{},peer:ctx.connection.browserPeer});
  const callSessionStatus=(peer,sessionId)=>ctx.typertGateway.invoke({namespace:'contextMonitorAcp',method:'sessionStatus',args:{sessionId},peer});
  assert.deepEqual(await callStatus(),acp.status(),'Settings acknowledgement is served by the real strict Gateway');
  const set=async enabled=>{
    const current=form();
    await ctx.settings.mutate('context-monitor-acp',[{op:'set',path:['acp'],value:{...current.value.acp,enabled}}],current.revision);
    await acp.c.idle();
    assert.equal(acp.status().phase,enabled?'on':'off',String(acp.diagnostic?.stack??acp.status().reason));
  };
  const agents=[];
  for(const agentPreset of ['standard','ptc','minimal','cordis']){
    const {sessionId}=await ctx.sessionController.create({cwd:workspace,agentPreset});
    const agent=ctx.agents.get(sessionId);assert.ok(agent,agentPreset);
    agents.push(agent);
  }
  const execute=(agent,line)=>ctx.commands.execute(agent,line,[],AbortSignal.timeout(10_000));
  const assertSessionBackend=async (agent,backend)=>assert.deepEqual(await callSessionStatus(ctx.connection.browserPeer,agent.id),{backend,unmanaged:false});
  await set(true);
  for(const agent of agents){
    await assertSessionBackend(agent,'builtin');
    assert.ok(ctx.commands.list(agent).some(row=>row.name==='acp-prune'));
    assert.ok(!ctx.commands.list(agent).some(row=>row.name==='compact'));
    assert.equal(await execute(agent,'/compact'),undefined,'ACP must not register a Host /compact handler');
    assert.equal((await execute(agent,'/acp-prune status')).result.kind,'success');
  }
  await set(false);
  for(const agent of agents){
    await assertSessionBackend(agent,'stock');
    assert.ok(!ctx.commands.list(agent).some(row=>row.name==='acp-prune'));
    assert.equal((await execute(agent,'/compact')).result.kind,'success');
  }
  await set(true);
  console.log('pass: four live presets, settings hot toggle, ACP status and stock command disabled/restored');

  if(process.argv.includes('--rpc-check')) {
    // Independent owner peers over the same strict gateway as the browser;
    // this covers the real write contract, not the rendering or DOM.
    const a=ctx.connection.createPeer({principal:{kind:'owner'},interactions:'none'});
    const b=ctx.connection.createPeer({principal:{kind:'owner'},interactions:'none'});
    const ns='context-monitor-acp';
    const rpc=(peer,namespace,method,args={})=>ctx.typertGateway.invoke({peer,namespace,method,args});
    const describe=async peer=>(await rpc(peer,'settings','describe')).namespaces.find(row=>row.ns===ns);
    const edit=(peer,row,value)=>rpc(peer,'settings','mutate',{ns,ops:[{op:'set',path:['acp'],value}],expectedRevision:row.revision});
    try {
      const before=await describe(a), stale=await describe(b);
      assert.equal(stale.revision,before.revision);
      const changed={...before.value.acp,enabled:false,nudgeMinContextLimitPct:.30,nudgeMaxContextLimitPct:.50,nudgeEmergencyThresholdPct:.70};
      const committed=await edit(a,before,changed);
      assert.ok(committed.revision>before.revision);
      await acp.c.idle();
      for(const peer of [a,b]) {
        const effective=await rpc(peer,'contextMonitorAcp','status');
        assert.equal(effective.phase,'off');
        assert.equal(effective.configApplied,true);
        assert.deepEqual((await describe(peer)).value.acp,changed);
      }
      await assert.rejects(edit(b,stale,{...stale.value.acp,enabled:true}),error=>error.code==='settings/conflict');
      const after=await describe(b);
      await assert.rejects(edit(b,after,{...after.value.acp,nudgeMinContextLimitPct:.9}),error=>error.code==='settings/rejected');
      assert.deepEqual((await describe(a)).value.acp,changed);
      await edit(a,await describe(a),before.value.acp);
      await acp.c.idle();
      assert.equal((await rpc(b,'contextMonitorAcp','status')).phase,'on');
      // Reproduce a live Agent outside the newly managed cohort. Backend
      // detection must follow its exact isolate even while the profile is on.
      const drop=await ctx.agentPresets.register({id:'retained-fixture',plugins:[{
        id:'compaction',name:'cordis:group',group:true,isolate:{compaction:true},
        config:[{id:'compaction-basic',name:'@deepseek-ai/dsh-compaction-basic'}],
      }]});
      try {
        const {sessionId}=await ctx.sessionController.create({cwd:workspace,agentPreset:'retained-fixture'});
        assert.equal((await rpc(b,'contextMonitorAcp','status')).phase,'on');
        assert.deepEqual(await callSessionStatus(a,sessionId),{backend:'stock',unmanaged:true});
        const missing='session-not-mounted-fixture';
        assert.deepEqual(await callSessionStatus(a,missing),{backend:'unknown',unmanaged:false});
        assert.equal(ctx.agents.get(missing),undefined,'inspection must not resume a session');
      } finally {await drop();}
      console.log('pass: actual session backend can differ from global profile status');
      console.log('pass: strict Settings RPC, two peers, stale revision refusal, invalid threshold refusal, and live restoration');
    } finally {await Promise.allSettled([a.dispose(),b.dispose()]);}
  } else {
  const {LlmAdapter,createUserMessage}=await load(req.resolve('@deepseek-ai/dsh-llm'));
  const scheduledTools=new Map();
  const scheduledOverflow=new Set();
  const pausedRequests=new Map();
  class LocalOnly extends LlmAdapter {
    async listModels(provider){return [{provider,id:'smoke-model',name:'Fixture model'}];}
    async resolveModel(provider,id){return {provider,id,name:'Fixture model',context:{contextWindow:128_000},defaultMaxTokens:2_048};}
    async *stream({messages,system,tools,sessionId,purpose,signal}){
      const res=await fetch(endpoint,{method:'POST',signal,headers:{'content-type':'application/json'},body:JSON.stringify({messages,system,tools,sessionId,purpose})});
      assert.ok(res.ok);
      const {text}=await res.json();
      const paused=pausedRequests.get(sessionId);
      if(paused){pausedRequests.delete(sessionId);paused.start();await paused.release;}
      if(purpose===undefined && scheduledOverflow.delete(sessionId)) {
        yield {type:'finish',reason:{kind:'error',failure:{code:'CONTEXT_WINDOW_EXCEEDED',message:'Synthetic overflow',status:400}}};
        return;
      }
      const tool=purpose===undefined ? scheduledTools.get(sessionId) : undefined;
      if(tool){
        scheduledTools.delete(sessionId);
        assert.ok(tools.some(x=>x.name===tool.name),'tool must appear in the actual provider catalog');
        yield {type:'block-start',index:0,blockType:'tool-call'};
        yield {type:'tool-call-delta',index:0,id:tool.id,name:tool.name,argumentsDelta:tool.arguments};
        yield {type:'block-end',index:0,block:tool};
        yield {type:'finish',reason:{kind:'tool-calls'}};
        return;
      }
      yield {type:'block-start',index:0,blockType:'text'};
      yield {type:'text-delta',index:0,text};
      yield {type:'block-end',index:0,block:{type:'text',text}};
      yield {type:'usage',usage:{inputTokens:100,outputTokens:8}};
      yield {type:'finish',reason:{kind:'stop'}};
    }
  }
  const local=ctx.llm.registerAdapter(['monitor-fake'],new LocalOnly());
  const prompt=async(agent,text)=>{
    agent.followup(createUserMessage({content:[{type:'text',text}],source:{kind:'user'}}));
    await agent.whenIdle();
  };
  const select=agent=>ctx.sessionController.selectModel({sessionId:agent.id,provider:'monitor-fake',model:'smoke-model'});
  const useTool=async(agent,name,args)=>{
    const id='fixture-tool-'+randomUUID();
    scheduledTools.set(agent.id,{type:'tool-call',id,name,arguments:JSON.stringify(args)});
    await prompt(agent,'Call fixture tool: '+name);
    assert.ok(!scheduledTools.has(agent.id),'fixture call reached the adapter');
    const result=agent.session.snapshotEvents(0).filter(x=>x.type==='tool/result').findLast(x=>JSON.stringify(x.data).includes(id));
    assert.ok(result,'tool must settle durably');
    return result;
  };
  try {
    if(process.argv.includes('--reopen')){
      const {sessionId,marker,summary}=JSON.parse(readFileSync(join(testRun,'restart-fixture.json'),'utf8'));
      await ctx.sessionController.selectModel({sessionId,provider:'monitor-fake',model:'smoke-model'});
      const reopened=ctx.agents.get(sessionId);
      assert.ok(reopened,'ordinary cold Session resolution must open persisted fixture');
      const reply=await execute(reopened,'/acp-prune status');
      assert.match(reply.result.text,/blocks:\s*1\b/);
      await prompt(reopened,'First turn after process restart');
      const sent=captures.find(p=>p.sessionId===sessionId && p.purpose===undefined);
      assert.ok(sent,'first post-restart outbound request');
      assert.ok(JSON.stringify(sent.messages).includes(summary));
      assert.ok(!JSON.stringify(sent.messages).includes(marker));
      console.log('pass: JSONL cold restart recovery and first provider request');
      const decompressed=await useTool(reopened,'decompress',{blockId:'b1'});
      assert.ok(JSON.stringify(decompressed.data).includes(marker),'decompress recovers the original from the persisted ledger');
      const searched=await useTool(reopened,'search_context',{query:marker});
      assert.ok(JSON.stringify(searched.data).includes(marker),'search_context finds the compressed original');
      const status=await useTool(reopened,'acp_status',{});
      assert.match(JSON.stringify(status.data),/\bb1\b|blocks/);
      console.log('pass: model-driven ACP read tools after process restart');
    }else{
      const busy=agents[3];
      await select(busy);
      await prompt(busy,'/compact');
      assert.ok(captures.some(request=>request.sessionId===busy.id&&request.purpose===undefined&&request.messages.some(message=>message.role==='user'&&JSON.stringify(message.content).includes('"text":"/compact"'))),'literal /compact can reach the fake provider as ordinary user text');
      const started=Promise.withResolvers(), release=Promise.withResolvers();
      pausedRequests.set(busy.id,{start:started.resolve,release:release.promise});
      const pending=prompt(busy,'Synthetic active turn');
      const timer=setTimeout(()=>started.reject(new Error('Fixture request did not start')),5000);
      let commit;
      try {
        await started.promise;
        commit=set(false);
        void commit.catch(()=>{});
        const deadline=Date.now()+4000;
        while(acp.status().phase!=='switching' && Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
        assert.equal(acp.status().phase,'switching');
        assert.equal(acp.status().configApplied,false);
        release.resolve();
        await pending;await commit;
        assert.equal((await callStatus()).configApplied,true);
      } finally {clearTimeout(timer);release.resolve();await Promise.allSettled([pending,commit]);}
      await set(true);
      console.log('pass: settings switch waits for the live turn without a restart');
      const agent=agents[0];
      await select(agent);
      const marker='raw-fixture-'+randomUUID();
      const summary='summary-fixture-'+randomUUID()+': '+ 'Synthetic source turn and fixture response were retained as a summary. '.repeat(8);
      for(let i=0;i<8;i++)await prompt(agent,i===1?`${marker}\n${'Synthetic older history, eligible for compression. '.repeat(160)}`:`Retained synthetic turn ${i}\n${'Synthetic tail keeps the source outside the recent-token guard. '.repeat(65)}`);
      assert.ok(captures.some(p=>p.sessionId===agent.id && JSON.stringify(p.messages).includes(marker)),'uncut history must reach the fake provider first');
      const events=agent.session.snapshotEvents(0);
      const users=events.filter(e=>e.type==='user/message'&&e.data.source?.kind==='user');
      assert.ok(users.length>=7,'durable fixture history');
      const start=users[1].seq,end=events.find(e=>e.seq>start&&e.type==='assistant/message').seq;
      const firstBlock=await useTool(agent,'compress',{content:[{startSeq:start,endSeq:end,summary}]});
      assert.ok(firstBlock.data.message.content.some(item=>item.type==='text'&&/Compressed 1 block\(s\).*\n.*tier 1/.test(item.text)));
      const endEvent=agent.session.snapshotEvents(0).findLast(e=>e.type==='compaction/end'&&!e.data.error);
      assert.ok(endEvent,'native compaction transaction must commit');
      const modelCallId=firstBlock.data.message.toolCallId;
      const latestRequest=captures.findLast(p=>p.sessionId===agent.id&&p.purpose===undefined);
      assert.ok(!JSON.stringify(latestRequest.messages).includes(modelCallId),'compaction bookkeeping tool pair is not replayed');
      console.log('pass: model compress tool committed one native ACP block and hid its own tool pair');
      await prompt(agent,'Parent retention checkpoint');
      const fork=await ctx.sessionController.fork({sessionId:agent.id});
      const child=ctx.agents.get(fork.sessionId);assert.ok(child,'real ordinary fork created a new Agent');
      assert.equal(child.session.header.parentSession,undefined);
      await select(child);
      await prompt(child,'First turn after ordinary fork');
      const sent=captures.find(p=>p.sessionId===fork.sessionId && p.purpose===undefined);
      assert.ok(sent,'first child outbound request');
      assert.ok(JSON.stringify(sent.messages).includes(summary),'first child request contains the checkpoint summary');
      assert.ok(!JSON.stringify(sent.messages).includes(marker),'first child request does not send shadowed original');
      writeFileSync(join(testRun,'restart-fixture.json'),JSON.stringify({sessionId:fork.sessionId,marker,summary}));
      console.log('pass: real ordinary fork, first loopback provider request is compacted');
      if(process.argv.includes('--tiers')) {
        const foldTier=async(from,expected)=>{
          const result=await useTool(agent,'compress',{content:[{startSeq:from,endSeq:from,summary:`Synthetic tier ${expected} summary. `+'The fixture source and its original marker remain recoverable. '.repeat(expected===2?3:1)}]});
          const reply=result.data.message.content.map(item=>item.text??'').join('\n');
          assert.match(reply,new RegExp(`tier ${expected}\\b`));
          const last=agent.session.snapshotEvents(0).findLast(e=>e.type==='compaction/summary');
          const meta=last.data.rawOutput.filter(x=>x.type==='text').map(x=>JSON.parse(x.text)).find(x=>x.$dshAcpBlockLedger===1);
          assert.equal(meta.tier,expected);
          assert.equal(meta.parentBlockIds.length,1);
          const recovered=await useTool(agent,'decompress',{blockId:meta.kernelBlockId});
          assert.ok(JSON.stringify(recovered.data).includes(marker),'distilled blocks retain their original references');
          return meta.kernelBlockId;
        };
        await foldTier(await foldTier('b1',2),3);
        console.log('pass: model-generated T2/T3 preserve their parent links and original content');
        const overflowAgent=agents[1];
        await select(overflowAgent);
        const early='overflow-fixture-'+randomUUID();
        for(let i=0;i<10;i++)await prompt(overflowAgent,`${i===1?early:'Overflow retained '+i}\n${'Synthetic overflow fixture content. '.repeat(320)}`);
        const before=captures.length;
        scheduledOverflow.add(overflowAgent.id);
        await prompt(overflowAgent,'The provider will report a context window overflow once');
        const requests=captures.slice(before).filter(x=>x.sessionId===overflowAgent.id&&x.purpose===undefined);
        assert.equal(requests.length,2,'provider-confirmed overflow gets exactly one retry');
        assert.ok(JSON.stringify(requests[0].messages).includes(early));
        assert.ok(requests[1].messages.length<requests[0].messages.length,'retry follows a durable surface reduction');
        const overflowEvents=overflowAgent.session.snapshotEvents(0);
        assert.ok(overflowEvents.some(e=>e.type==='compaction/end'&&!e.data.error));
        console.log('pass: provider-confirmed overflow committed a reduction before retry');
        const invalid=agents[2];
        await select(invalid);
        await prompt(invalid,'Clean fixture turn before a malformed ACP ledger');
        const session=invalid.session, compactionId=randomUUID();
        session.append('compaction/start',{compactionId,turn:null});
        session.append('compaction/summary',{
          compactionId,summary:[{type:'text',text:'Synthetic invalid ledger'}],
          shadowedRange:{start:999999,end:999999},shadowedSeqs:[999999],shadowedTokenCount:99,
          provider:'monitor-fake',model:'smoke-model',
          rawOutput:[{type:'text',text:JSON.stringify({$dshAcpBlockLedger:1,tier:1,kernelBlockId:'b1',directMessageIds:['999999'],effectiveMessageIds:['999999'],parentBlockIds:[]})}],
        });
        session.append('compaction/end',{compactionId,turn:null});
        const beforeInvalid=captures.length;
        await prompt(invalid,'This request must not leave an invalid restored ACP session');
        assert.equal(captures.length,beforeInvalid,'recognized invalid native ledger must not fall through to provider');
        console.log('pass: an invalid native ACP ledger was rejected before provider dispatch');
      }
    }
  }finally{local();}
  }
} finally {try{await ctx.fiber.dispose();}finally{mock.close();mock.closeAllConnections();}}
