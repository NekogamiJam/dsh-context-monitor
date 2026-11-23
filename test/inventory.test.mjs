import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../client.js',import.meta.url),'utf8');
const start=source.indexOf('const backendLabels=');
const end=source.indexOf('function useFormSnapshot',start);
assert.ok(start>=0&&end>start,'standalone status mapper');
const present=new Function(source.slice(start,end)+';return backendPresentation;')();

test('a confirmed current-session backend has a positive tone and an exact label',()=>{
  for(const [kind,label] of Object.entries({builtin:'sessionBuiltin',stock:'sessionStock',external:'sessionExternal'})) {
    assert.deepEqual(present(kind),{label,detected:true});
  }
});

test('absence, switching, and a missing or malformed report are never highlighted',()=>{
  assert.deepEqual(present('none'),{label:'sessionNone',detected:false});
  assert.deepEqual(present('switching'),{label:'sessionSwitching',detected:false});
  for(const kind of ['unknown',null,undefined,'__proto__','on',{}]) {
    assert.deepEqual(present(kind),{label:'sessionUnknown',detected:false});
  }
});

test('the monitor reports backend presence in one accessible line',()=>{
  assert.equal((source.match(/role:'status',className:'dcm-muted dcm-backend'/g)??[]).length,1);
  assert.match(source, /'data-present':shownBackend\.detected/);
  assert.match(source, /\.dcm-backend\[data-present="true"\]\{color:var\(--dsw-alias-state-success-primary,/);
  assert.match(source, /内置 ACP（billion-context-dsh）/);
  assert.doesNotMatch(source, /checkInventory\(|remote\.pluginInventory/);
});
