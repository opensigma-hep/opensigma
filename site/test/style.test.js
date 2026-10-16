import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Light-theme tokens are the first :root block.
const light = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8').split('}')[0];
const hex = (name) => light.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6})`))[1];
const lum = (h) => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('light: ratio midpoint fill is distinguishable from the empty-cell fill', () => {
  assert.ok(contrast(hex('rat-3'), hex('cell-empty')) >= 1.25);
});
