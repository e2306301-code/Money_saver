const expenseNames = [
  ['food', '食費'], ['daily', '日用品'], ['transport', '交通'],
  ['housing', '住居'], ['utilities', '光熱費'], ['fun', '娯楽'], ['other', 'その他'],
];
const incomeNames = [
  ['salary', '給与'], ['side', '副収入'], ['extra', '臨時収入'], ['other', 'その他'],
];

export const DEFAULT_CATEGORIES = [
  ...expenseNames.map(([id, name]) => ({ id: `expense-${id}`, type: 'expense', name, builtIn: true })),
  ...incomeNames.map(([id, name]) => ({ id: `income-${id}`, type: 'income', name, builtIn: true })),
];

export function isRealDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function validateEntry(input) {
  const errors = {};
  const type = input.type;
  const rawAmount = String(input.amount ?? '').trim();
  const amount = Number(rawAmount);
  const categoryId = String(input.categoryId ?? '').trim();
  const date = String(input.date ?? '');
  const memo = String(input.memo ?? '').trim();
  if (type !== 'income' && type !== 'expense') errors.type = '収入か支出を選んでください';
  if (!/^\d+$/.test(rawAmount) || !Number.isSafeInteger(amount) || amount < 1) errors.amount = '1円以上の整数を入力してください';
  if (!categoryId) errors.categoryId = 'カテゴリを選んでください';
  if (!isRealDate(date)) errors.date = '正しい日付を入力してください';
  if (Object.keys(errors).length) return { valid: false, errors };
  return { valid: true, errors, value: { type, amount, categoryId, date, memo } };
}

export function entriesForMonth(entries, monthKey) {
  return entries.filter(entry => entry.date.slice(0, 7) === monthKey);
}

export function summarize(entries) {
  const total = entries.reduce((result, entry) => {
    if (entry.type === 'income') result.income += entry.amount;
    if (entry.type === 'expense') result.expense += entry.amount;
    return result;
  }, { income: 0, expense: 0 });
  return { ...total, balance: total.income - total.expense };
}

export function sortEntriesNewest(entries) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function addCategory(categories, input, idFactory) {
  const type = input.type;
  const name = String(input.name ?? '').trim();
  if (type !== 'income' && type !== 'expense') return { categories, error: '種別を選んでください' };
  if (!name) return { categories, error: 'カテゴリ名を入力してください' };
  if (name.length > 24) return { categories, error: 'カテゴリ名は24文字以内にしてください' };
  if (categories.some(category => category.type === type && category.name.toLocaleLowerCase('ja-JP') === name.toLocaleLowerCase('ja-JP'))) {
    return { categories, error: '同じカテゴリがすでにあります' };
  }
  return { categories: [...categories, { id: idFactory(), type, name, builtIn: false }], error: null };
}

export function removeCustomCategory(categories, id) {
  const category = categories.find(item => item.id === id);
  if (!category || category.builtIn) return { categories, error: 'このカテゴリは削除できません' };
  return { categories: categories.filter(item => item.id !== id), error: null };
}
