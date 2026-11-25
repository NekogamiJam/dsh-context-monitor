import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import semver from 'semver';
const manifest=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const range=manifest.engines.dsh;
const dshPeers=Object.keys(manifest.peerDependencies).filter(name=>name.startsWith('@deepseek-ai/dsh-'));
test('declares rc.5 as the guaranteed host and 0.2.3 prereleases as untested preview',()=>{
  assert.ok(semver.validRange(range));
  assert.equal(range,'0.2.2-rc.5 || >=0.2.3-0 <0.2.3');
  for(const version of ['0.2.2-rc.5','0.2.3-alpha.1','0.2.3-alpha.2','0.2.3-beta.1','0.2.3-rc.1'])assert.equal(semver.satisfies(version,range),true,version);
  for(const version of ['0.1.7-rc.2','0.2.1-rc.5','0.2.2-alpha.3','0.2.2-rc.1','0.2.2-rc.4','0.2.2-rc.6','0.2.2','0.2.3','0.2.4-alpha.1','1.0.0'])assert.equal(semver.satisfies(version,range),false,version);
});
test('each direct DSH peer accepts rc.5 and the 0.2.3 prerelease line only',()=>{
  assert.ok(dshPeers.length>=6);
  for(const peer of dshPeers){
    const peerRange=manifest.peerDependencies[peer];
    assert.ok(semver.validRange(peerRange),peer);
    for(const version of ['0.2.2-rc.5','0.2.3-alpha.1','0.2.3-alpha.2'])assert.equal(semver.satisfies(version,peerRange),true,`${peer}@${version}`);
    for(const version of ['0.2.2','0.2.2-rc.4','0.2.3','0.2.4-alpha.1'])assert.equal(semver.satisfies(version,peerRange),false,`${peer}@${version}`);
  }
});
test('Schemastery admits the rc.5 and current alpha host versions',()=>{
  const range=manifest.peerDependencies['@deepseek-ai/schemastery'];
  for(const version of ['3.19.0','3.20.0-alpha.1','3.20.0-alpha.2'])assert.equal(semver.satisfies(version,range),true,version);
  for(const version of ['3.18.0','3.20.0','3.21.0-alpha.1'])assert.equal(semver.satisfies(version,range),false,version);
});
test('lockfile root host range and peers match manifest',()=>{
  const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
  assert.equal(lock.packages[''].engines.dsh,range);
  assert.equal(lock.packages[''].version,manifest.version);
  assert.deepEqual(lock.packages[''].peerDependencies,manifest.peerDependencies);
});
