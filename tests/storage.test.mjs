import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, createStorage } from '../js/storage.js';

function memoryStorage(initial = {}) {
  return {
    data: { ...initial },
    getItem(key) { return this.data[key] ?? null; },
    setItem(key, value) { this.data[key] = value; },
  };
}

test('empty storage loads built-in categories', () => {
  const result = createStorage(memoryStorage()).load();
  assert.equal(result.recovered, false);
  assert.equal(result.state.version, 1);
  assert.ok(result.state.categories.some(category => category.name === '食費'));
});

test('saved entries survive reload', () => {
  const storage = memoryStorage();
  const state = createInitialState();
  state.entries.push({ id: 'one', type: 'expense', amount: 100, categoryId: 'expense-food', categoryName: '食費', memo: '', date: '2026-09-15', createdAt: '2026-09-15T00:00:00Z', updatedAt: '2026-09-15T00:00:00Z' });
  assert.equal(createStorage(storage).save(state).ok, true);
  assert.deepEqual(createStorage(storage).load().state.entries, state.entries);
});

test('malformed JSON remains untouched on load', () => {
  const storage = memoryStorage({ 'simple-kakeibo:v1': '{broken' });
  const result = createStorage(storage).load();
  assert.equal(result.recovered, true);
  assert.match(result.error, /読み込めませんでした/);
  assert.equal(storage.data['simple-kakeibo:v1'], '{broken');
});

test('structurally invalid saved data remains untouched', () => {
  const bad = JSON.stringify({ version: 1, entries: [{}], categories: [] });
  const storage = memoryStorage({ 'simple-kakeibo:v1': bad });
  assert.equal(createStorage(storage).load().recovered, true);
  assert.equal(storage.data['simple-kakeibo:v1'], bad);
});

test('quota failure returns an error instead of reporting success', () => {
  const storage = memoryStorage();
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const result = createStorage(storage).save(createInitialState());
  assert.equal(result.ok, false);
  assert.match(result.error, /保存できませんでした/);
});
