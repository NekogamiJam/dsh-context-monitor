import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const chart = source.slice(source.indexOf('function Chart('), source.indexOf('class Boundary'));
const css = source.slice(source.indexOf('const css = `'), source.indexOf('const fmt ='));

test('history defaults to the latest 600 samples', () => {
  assert.match(source, /\[range,setRange\]=React\.useState\(600\)/);
});

test('both charts share HTML y-axis labels instead of clipped SVG text', () => {
  assert.match(chart, /h\('div',\{className:'dcm-yaxis'/);
  assert.doesNotMatch(chart, /h\('text'/);
  assert.match(chart, /preserveAspectRatio:'none'/);
  assert.match(css, /grid-template-columns:max-content minmax\(0,1fr\)/);
  assert.match(css, /\.dcm-yaxis\{[^}]*white-space:nowrap/);
});

test('mobile font enlargement cannot outgrow a fixed SVG gutter', () => {
  assert.doesNotMatch(css, /\.dcm-chart text/);
  assert.doesNotMatch(chart, /L=55/);
  assert.match(css, /\.dcm-yaxis\{[^}]*height:190px/);
  assert.match(css, /\.dcm-chart\{[^}]*height:190px/);
  assert.match(css, /vector-effect:non-scaling-stroke/);
});

test('capacity and dates use wrapping HTML outside the SVG plot', () => {
  assert.match(chart, /className:'dcm-chart-cap dcm-muted'/);
  assert.match(chart, /className:'dcm-chart-times'/);
  assert.match(chart, /h\('time'/);
  assert.match(css, /\.dcm-chart-times time\{[^}]*overflow-wrap:anywhere/);
});

test('monitor cards share one bounded grid column and tables scroll within it', () => {
  assert.match(css, /\.dcm \.dcm-inner\{inline-size:100%;min-inline-size:0;display:grid;grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css, /\.dcm-inner>\*\{min-inline-size:0\}/);
  assert.match(css, /\.dcm-inner>\.dcm-card\{inline-size:100%;max-inline-size:100%;justify-self:stretch\}/);
  assert.match(css, /\.dcm-tablewrap\{inline-size:100%;min-inline-size:0;max-inline-size:100%;overflow-x:auto\}/);
  assert.match(css, /\.dcm-tablewrap>table\{inline-size:100%;min-inline-size:38rem\}/);
});
