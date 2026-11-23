import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../client.js',import.meta.url),'utf8');

test('native ACP settings page uses shared volatile form and CAS mutation',()=>{
  assert.match(source,/configForms\.get\(['"]context-monitor-acp['"]\)/);
  assert.match(source,/mutate\(\[\{op:['"]set['"],path:\[['"]acp['"]\],value\}\],draftRevision\)/);
  assert.match(source,/acpRebase/);
  assert.match(source,/setDraftRevision\(snapshot\.revision\)/);
  for(const field of ['enabled','nudgeMinContextLimitPct','nudgeMaxContextLimitPct','nudgeEmergencyThresholdPct','autoNudge','autoTools','autoCommand','autoModelContextLimit','modelContextLimit','maxOverflowRetries','coreOverrides','prompts'])assert.match(source,new RegExp(field));
});

test('all five ACP presets preserve exact requested thresholds',()=>{
  for(const [name,values] of Object.entries({preserve:['0.55','0.78','0.93'],relaxed:['0.50','0.75','0.90'],balanced:['0.45','0.70','0.85'],efficient:['0.40','0.60','0.78'],aggressive:['0.30','0.50','0.70']})){
    const row=source.slice(source.indexOf(name+':'),source.indexOf('\n',source.indexOf(name+':')));
    for(const value of values)assert.ok(row.includes(value),`${name} must include ${value}`);
  }
});

test('ACP status cards retain exactly two equal columns and wrap long content',()=>{
  assert.match(source,/\.dcm-status-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(source,/\.dcm-status-grid>div\{overflow-wrap:anywhere/);
});

test('ACP status is read-only and unavailable status cannot claim Apply success',()=>{
  assert.match(source,/contextMonitorAcp\/status/);
  assert.match(source,/acpStatusUnavailable/);
  assert.match(source,/effectiveEnabled/);
  assert.match(source,/phase==='blocked'/);
  assert.match(source,/acpSaveFailed/);
});

test('an accepted Apply revision can settle beyond the immediate status polls',()=>{
  assert.match(source,/setPendingRevision\(latest\.revision\)/);
  assert.match(source,/commands\/change',refresh/);
  assert.match(source,/snapshot\.revision!==pendingRevision[^\n]+acpSuperseded/);
  assert.match(source,/status\?\.configApplied===true[^\n]+acpApplied/);
  assert.match(source,/read===statusEpoch\.current/);
  assert.match(source,/disabled:saving\|\|snapshot\.status/);
});

test('ACP rows use the native command group and stage canonical text only in an empty composer',()=>{
  assert.match(source,/ctx\.commandUi\.register/);
  assert.doesNotMatch(source,/inputTriggers\.registerSource/);
  assert.match(source,/name:`acp-prune \$\{verb\}`/);
  assert.match(source,/input\.setDraft\(`\/acp-prune \$\{verb\} `/);
  assert.match(source,/state\.draft\.trim\(\)\|\|state\.attachmentIds\.length/);
  const commands=source.slice(source.indexOf('function registerAcpCommands()'),source.indexOf('ctx.effect(registerAcpCommands)'));
  assert.doesNotMatch(commands,/\.notify\(/,'menu picks must not leave a composer notice');
  for (const field of ['acpStatusUsage','acpCompressUsage','acpDecompressUsage']) assert.match(source,new RegExp(field));
});
test('monitor uses the actual session backend independently of profile settings',()=>{
  const monitor=source.slice(source.indexOf('function Monitor('),source.indexOf('function View('));
  assert.match(monitor,/readSessionAcpStatus\(props\.sessionId\)/);
  assert.match(monitor,/id===backendRequest\.current/);
  assert.match(monitor,/\('api-session\/added',summary=>updateSession\(summary\.sessionId\)\)/);
  assert.doesNotMatch(monitor,/readAcpStatus|effectiveEnabled|thirdParty|checked/);
});
