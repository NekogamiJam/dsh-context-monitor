import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const patch=readFileSync(new URL('../cordis.patch.yml',import.meta.url),'utf8');
const versionExpr="process.getBuiltinModule('node:module').createRequire(baseUrl)('@deepseek-ai/dsh/package.json').version.startsWith('0.2.3-')";
const cordisDirExpr="process.getBuiltinModule('node:path').join(process.getBuiltinModule('node:path').dirname(process.getBuiltinModule('node:module').createRequire(baseUrl).resolve('@deepseek-ai/dsh-agent-preset/package.json')), 'skills')";
const toolCordisDisabled=`!${versionExpr}`;
const ptcPluginManagerDisabled=`!${versionExpr} || !ctx.get('profileContext')`;
const ptcSkillsConfig=`${versionExpr} ? { customSkillDirs: [${cordisDirExpr}] } : undefined`;
const cordisSkillsConfig=`${versionExpr} ? { excludedSkills: ['official-plugins', 'personalized-pages'] } : undefined`;

function evaluate(expression,baseUrl,ctx={get:()=>undefined}) {
  return new Function('process','baseUrl','ctx',`return (${expression})`)(process,baseUrl,ctx);
}
function fixture(version) {
  const root=mkdtempSync(join(tmpdir(),'dcm-dsh-alpha-preview-'));
  const dsh=join(root,'node_modules','@deepseek-ai','dsh');
  const preset=join(root,'node_modules','@deepseek-ai','dsh-agent-preset');
  mkdirSync(dsh,{recursive:true});mkdirSync(preset,{recursive:true});
  writeFileSync(join(dsh,'package.json'),JSON.stringify({name:'@deepseek-ai/dsh',version,exports:{'./package.json':'./package.json'}}));
  writeFileSync(join(preset,'package.json'),JSON.stringify({name:'@deepseek-ai/dsh-agent-preset',exports:{'./package.json':'./package.json'}}));
  return {root,baseUrl:join(root,'loader.mjs')};
}

test('0.2.3-only Cordis preset deltas leave the rc.5 composition unchanged',()=>{
  assert.ok(patch.includes(`disabled: !!js "${toolCordisDisabled}"`));
  assert.ok(patch.includes(`disabled: !!js "${ptcPluginManagerDisabled}"`));
  assert.ok(patch.includes(`config: !!js "${ptcSkillsConfig}"`));
  assert.ok(patch.includes(`config: !!js "${cordisSkillsConfig}"`));
  for(const version of ['0.2.2-rc.5','0.2.3-alpha.1','0.2.3-alpha.2']){
    const f=fixture(version);
    try {
      const alpha=version.startsWith('0.2.3-');
      assert.equal(evaluate(toolCordisDisabled,f.baseUrl),!alpha,`${version}: Cordis tool visibility`);
      assert.equal(evaluate(ptcPluginManagerDisabled,f.baseUrl,{get:key=>key==='profileContext'}),!alpha,`${version}: PTC plugin manager with profile`);
      assert.equal(evaluate(ptcPluginManagerDisabled,f.baseUrl),true,`${version}: PTC plugin manager without profile`);
      assert.deepEqual(evaluate(ptcSkillsConfig,f.baseUrl),alpha?{customSkillDirs:[join(f.root,'node_modules','@deepseek-ai','dsh-agent-preset','skills')]}:undefined,`${version}: PTC skills config`);
      assert.deepEqual(evaluate(cordisSkillsConfig,f.baseUrl),alpha?{excludedSkills:['official-plugins','personalized-pages']}:undefined,`${version}: Cordis skill exclusions`);
    } finally {rmSync(f.root,{recursive:true,force:true});}
  }
});
