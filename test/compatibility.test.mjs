import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import semver from 'semver';
const manifest=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const range=manifest.engines.dsh;
test('declared DSH range is valid and limited to the reviewed 0.2.2 release line',()=>{
 assert.ok(semver.validRange(range));
 assert.equal(range,'>=0.2.2-rc.1 <0.2.3-0');
});
test('default semver prerelease rules admit reviewed candidates without includePrerelease',()=>{
 for(const version of ['0.2.2-rc.1','0.2.2-rc.2','0.2.2-rc.3','0.2.2-rc.4','0.2.2'])assert.ok(semver.satisfies(version,range),version);
});
test('exclude earlier APIs, alpha/beta builds and the next release line including prereleases',()=>{
 for(const version of ['0.1.7-rc.2','0.2.0-rc.2','0.2.1-rc.5','0.2.1','0.2.2-alpha.3','0.2.2-beta.1','0.2.3-0','0.2.3-alpha.1','0.2.3','0.3.0','1.0.0'])assert.equal(semver.satisfies(version,range),false,version);
});
test('lockfile root host range matches manifest',()=>{
 const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
 assert.equal(lock.packages[''].engines.dsh,range);
});
