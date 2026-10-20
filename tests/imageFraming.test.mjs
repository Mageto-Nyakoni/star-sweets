import assert from 'node:assert/strict';
import test from 'node:test';
import { imagePosition, hotspotPosition } from '../src/lib/imageFraming.js';

test('existing photos without framing metadata remain centered', () => {
  for (const missing of [undefined, null, {}]) {
    assert.equal(imagePosition(missing), '50% 50%');
    assert.equal(hotspotPosition(missing), '50% 50%');
  }
});

test('supports independent axes and edge focal points', () => {
  assert.equal(imagePosition({ x: 0, y: 100 }), '0% 100%');
  assert.equal(imagePosition({ y: 25 }), '50% 25%');
  assert.equal(hotspotPosition({ x: 0.25, y: 0.75 }), '25% 75%');
  assert.equal(hotspotPosition({ x: 1, y: 0 }), '100% 0%');
});

test('invalid external focal points cannot produce invalid image styles', () => {
  for (const value of [-1, 101, Infinity, NaN, '25', '0%; display:none', null]) {
    assert.equal(imagePosition({ x: value, y: 20 }), '50% 20%');
  }
  for (const value of [-0.1, 1.1, Infinity, NaN, '0.25', null]) {
    assert.equal(hotspotPosition({ x: value, y: 0.5 }), '50% 50%');
  }
});
