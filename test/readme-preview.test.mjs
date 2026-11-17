import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('cache-share panel omits the cumulative cache-write row but retains its ratio explanation', () => {
  const client = read('client.js');
  assert.doesNotMatch(client, /cacheWrite\s*:/);
  assert.doesNotMatch(client, /t\(['"]cacheWrite['"]\)/);
  assert.match(client, /t\('ratioNote'\)/);
});

test('README embeds a clearly fictional, self-contained privacy-safe interface schematic', () => {
  const readme = read('README.md');
  const svg = read('docs/context-monitor-preview.svg');
  assert.match(readme, /!\[[^\]]*去敏界面示意图[^\]]*\]\(docs\/context-monitor-preview\.svg\)/);
  assert.match(readme, /所有数字和记录均为虚构样例/);
  assert.match(svg, /全部数字为虚构样例/);
  assert.doesNotMatch(svg, /<script|<foreignObject|<image\b|\bon\w+\s*=|href\s*=\s*["']https?:\/\//i);
  assert.doesNotMatch(svg, /[A-Z]:\\(?:Users|Program Files)\\|session-[a-f0-9-]{20,}|(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/i);
  assert.match(svg, /缓存读取比例变化/);
  assert.doesNotMatch(svg, /累计缓存写入|Cache writes \(host\)/);
});
