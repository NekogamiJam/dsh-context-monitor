import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../client.js',import.meta.url),'utf8');
const a=source.indexOf('const cachedArea = () => {');
const b=source.indexOf('const marks=',a);
const area=samples=>new Function('samples','x','y','valid',source.slice(a,b)+'return cachedArea();')(samples,i=>i*10,v=>100-v,n=>typeof n==='number'&&Number.isFinite(n)&&n>=0);
const point=(read,model='m')=>({read,provider:'p',model});
test('cache area closes at baseline and spans valid samples',()=>{
 assert.equal(area([point(20),point(30)]),'M0,100 L0,80 L10,70 L10,100 Z');
});
test('missing cache samples leave gaps rather than inventing zeros',()=>{
 const path=area([point(10),point(null),point(20)]);
 assert.equal((path.match(/M/g)||[]).length,2);
 assert.doesNotMatch(path,/L10,/);
 assert.equal(area([point(null)]),'');
});
test('route changes split filled polygons and zero remains valid',()=>{
 assert.equal((area([point(10),point(20,'other')]).match(/Z/g)||[]).length,2);
 assert.equal(area([point(0)]),'M0,100 L0,100 L0,100 Z');
});
test('cache fill has no outline and renders beneath unchanged total-input stroke',()=>{
 assert.match(source,/\.dcm-cached\{stroke:none;fill:var\(--dsw-alias-state-business-primary\);fill-opacity:\.22\}/);
 assert.match(source,/\.dcm-dot\.cache\{background:var\(--dsw-alias-state-business-primary\);opacity:\.22\}/);
 assert.match(source,/\.dcm-input\{stroke:var\(--dsw-alias-state-business-primary\);fill:none;stroke-width:2\}/);
 const cache=source.indexOf("if(!ratio)children.push(h('path',{key:'cache'");
 const input=source.indexOf("children.push(h('path',{key:'input'");
 assert.ok(cache>0&&cache<input);
});
