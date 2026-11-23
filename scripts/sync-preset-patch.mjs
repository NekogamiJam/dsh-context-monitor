// Run using an ASAR-aware Node with DSH_INSTALL_DIR referencing the approved
// DSH Web installation. Fails on unexpected upstream composition changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const install=process.env.DSH_INSTALL_DIR;
if(!install) throw new Error('DSH_INSTALL_DIR required');
const resolve=createRequire(join(install,'package.json')).resolve;
const upstream='@deepseek-ai/dsh-web-app';
const webManifest=JSON.parse(readFileSync(resolve(`${upstream}/package.json`),'utf8'));
if(webManifest.version!=='0.2.2-rc.5')throw new Error(`Unsupported Web preset revision: ${webManifest.version}`);
let text='# Only the scoped stock compaction backend/command pair is replaced.\n# Web presets derived from DeepSeek Harness dsh-v0.2.2-rc.5 (MIT).\n- insert:\n    - id: local-context-monitor\n      name: dsh-context-monitor\n    - id: context-monitor-acp\n      name: dsh-context-monitor/acp\n';
for(const preset of ['standard','ptc','minimal','cordis']){
  const raw=readFileSync(resolve(`${upstream}/presets/${preset}.patch.yml`),'utf8').replace(/\r\n/g,'\n');
  const start=`    - id: preset-${preset}\n`;
  const old=`              - id: compaction-basic\n                name: '@deepseek-ai/dsh-compaction-basic'\n              - id: command-compact\n                name: '@deepseek-ai/dsh-command-compact'`;
  const at=raw.indexOf(start);
  if(at<0||raw.split(old).length!==2||raw.slice(at).split(/^    - /m).length!==2)throw new Error(`Unexpected preset shape: ${preset}`);
  const replacement=`              - id: context-monitor-acp-${preset}\n                name: dsh-context-monitor/acp/preset\n                config:\n                  preset: ${preset}`;
  text+='\n'+raw.slice(at).replace(old,replacement).trimEnd().split('\n').map(l=>l ? l.slice(4) : '').join('\n')+'\n';
}
writeFileSync(new URL('../cordis.patch.yml',import.meta.url),text);
