import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactPageWindow } from '../lib/pagination';

test('compactPageWindow centres on the current page', () => {
  assert.deepEqual(compactPageWindow(5, 11), [4, 5, 6]);
});

test('compactPageWindow keeps three pages at either end', () => {
  assert.deepEqual(compactPageWindow(1, 11), [1, 2, 3]);
  assert.deepEqual(compactPageWindow(11, 11), [9, 10, 11]);
});

test('compactPageWindow handles short and out-of-range inputs', () => {
  assert.deepEqual(compactPageWindow(1, 1), [1]);
  assert.deepEqual(compactPageWindow(2, 2), [1, 2]);
  assert.deepEqual(compactPageWindow(99, 4), [2, 3, 4]);
  assert.deepEqual(compactPageWindow(0, 4), [1, 2, 3]);
  assert.deepEqual(compactPageWindow(1, 0), []);
});
