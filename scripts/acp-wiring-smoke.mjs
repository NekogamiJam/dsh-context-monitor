#!/usr/bin/env node
// Detached fixture using the installed Desktop services without reading any
// live profile or starting a provider. Run with Electron-as-Node.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const root=process.env.DSH_INSTALL_DIR;
if(!root)throw new Error('DSH_INSTALL_DIR required');
const resolve=createRequire(join(root,'package.json')).resolve;
const load=key=>import(pathToFileURL(resolve(`@deepseek-ai/${key}`)).href);
const [{Context,Service}, {default:Typert}, {default:AgentCommands}, {ContextMonitorAcp}] = await Promise.all([
  load('cordis'),load('dsh-typert-registry'),load('dsh-commands'),import('../acp/host.js'),
]);
const ctx=new Context();
await ctx.plugin(Typert);
await ctx.plugin(AgentCommands);
class FixtureLoader extends Service {
  constructor(c){super(c,'loader');}
  entries(){return [];}
}
await ctx.plugin(FixtureLoader);
const host=ctx.plugin(ContextMonitorAcp,{});
await host;
try {
  assert.ok(ctx.contextMonitorAcp,'Host published coordinator');
  await ctx.contextMonitorAcp.c.idle();
  const state=ctx.contextMonitorAcp.status();
  assert.equal(state.requestedEnabled,true);
  assert.equal(state.effectiveEnabled,false);
  assert.equal(state.reason,'unmanaged-preset');
  const desc=ctx.typert.local.get('contextMonitorAcp/status');
  assert.equal(desc?.service,'contextMonitorAcp');
  console.log(JSON.stringify({context:true,settings:state,strictRemote:desc.result.mode==='strict'}));
} finally {await ctx.fiber.dispose();}
