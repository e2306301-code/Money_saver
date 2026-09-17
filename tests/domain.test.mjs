import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CATEGORIES,
  addCategory,
  entriesForMonth,
  removeCustomCategory,
  sortEntriesNewest,
  summarize,
  validateEntry,
} from '../js/domain.js';

test('invalid amount, category and date are rejected', () => {
  const result = validateEntry({ type: 'expense', amount: '0.5', categoryId: '', date: 'bad', memo: '' });
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['amount', 'categoryId', 'date']);
});

test('valid input is normalized', () => {
  const result = validateEntry({ type: 'income', amount: '1000', categoryId: 'income-salary', date: '2026-09-15', memo: ' 給料 ' });
  assert.equal(result.valid, true);
  assert.deepEqual(result.value, { type: 'income', amount: 1000, categoryId: 'income-salary', date: '2026-09-15', memo: '給料' });
});

test('impossible calendar date is rejected', () => {
  const result = validateEntry({ type: 'expense', amount: '1', categoryId: 'expense-food', date: '2026-02-30', memo: '' });
  assert.equal(result.errors.date, '正しい日付を入力してください');
});

test('monthly entries are summarized with the correct balance', () => {
  const entries = [
    { id: '1', type: 'income', amount: 200000, date: '2026-09-01' },
    { id: '2', type: 'expense', amount: 1200, date: '2026-09-02' },
    { id: '3', type: 'expense', amount: 500, date: '2026-08-31' },
  ];
  assert.deepEqual(summarize(entriesForMonth(entries, '2026-09')), { income: 200000, expense: 1200, balance: 198800 });
});

test('newest date and creation time sort first without mutating input', () => {
  const entries = [
    { id: 'old', date: '2026-09-01', createdAt: '2026-09-01T01:00:00Z' },
    { id: 'new', date: '2026-09-02', createdAt: '2026-09-02T01:00:00Z' },
    { id: 'newer', date: '2026-09-02', createdAt: '2026-09-02T02:00:00Z' },
  ];
  assert.deepEqual(sortEntriesNewest(entries).map(entry => entry.id), ['newer', 'new', 'old']);
  assert.deepEqual(entries.map(entry => entry.id), ['old', 'new', 'newer']);
});

test('default categories have separate income and expense groups', () => {
  assert.ok(DEFAULT_CATEGORIES.some(category => category.id === 'expense-food' && category.name === '食費'));
  assert.ok(DEFAULT_CATEGORIES.some(category => category.id === 'income-salary' && category.name === '給与'));
});

test('custom category can be added and duplicate names cannot', () => {
  const added = addCategory(DEFAULT_CATEGORIES, { type: 'expense', name: ' 医療費 ' }, () => 'medical');
  assert.equal(added.error, null);
  assert.deepEqual(added.categories.at(-1), { id: 'medical', type: 'expense', name: '医療費', builtIn: false });
  assert.match(addCategory(added.categories, { type: 'expense', name: '医療費' }, () => 'duplicate').error, /すでにあります/);
  assert.match(addCategory(DEFAULT_CATEGORIES, { type: 'expense', name: ' 食費 ' }, () => 'duplicate').error, /すでにあります/);
});

test('only custom categories can be removed', () => {
  const added = addCategory(DEFAULT_CATEGORIES, { type: 'income', name: 'おこづかい' }, () => 'pocket');
  assert.equal(removeCustomCategory(added.categories, 'pocket').categories.some(category => category.id === 'pocket'), false);
  assert.match(removeCustomCategory(DEFAULT_CATEGORIES, 'expense-food').error, /削除できません/);
});
