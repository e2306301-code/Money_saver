import { DEFAULT_CATEGORIES, isRealDate } from './domain.js';

export const STORAGE_KEY = 'simple-kakeibo:v1';

export function createInitialState() {
  return { version: 1, entries: [], categories: DEFAULT_CATEGORIES.map(category => ({ ...category })) };
}

function validCategory(category) {
  return category && typeof category.id === 'string' && category.id.length > 0 &&
    (category.type === 'income' || category.type === 'expense') &&
    typeof category.name === 'string' && category.name.length > 0 &&
    typeof category.builtIn === 'boolean';
}

function validEntry(entry) {
  return entry && typeof entry.id === 'string' && entry.id.length > 0 &&
    (entry.type === 'income' || entry.type === 'expense') &&
    Number.isSafeInteger(entry.amount) && entry.amount >= 1 &&
    typeof entry.categoryId === 'string' && entry.categoryId.length > 0 &&
    typeof entry.categoryName === 'string' && entry.categoryName.length > 0 &&
    typeof entry.memo === 'string' && isRealDate(entry.date) &&
    typeof entry.createdAt === 'string' && typeof entry.updatedAt === 'string';
}

function validState(value) {
  return value && value.version === 1 && Array.isArray(value.entries) &&
    Array.isArray(value.categories) && value.entries.every(validEntry) &&
    value.categories.every(validCategory) &&
    new Set(value.entries.map(entry => entry.id)).size === value.entries.length &&
    new Set(value.categories.map(category => category.id)).size === value.categories.length;
}

export function createStorage(storageLike) {
  return {
    load() {
      try {
        const raw = storageLike.getItem(STORAGE_KEY);
        if (raw === null) return { state: createInitialState(), recovered: false, error: null };
        const state = JSON.parse(raw);
        if (!validState(state)) throw new Error('invalid shape');
        return { state, recovered: false, error: null };
      } catch {
        return {
          state: createInitialState(),
          recovered: true,
          error: '保存データを読み込めませんでした。元のデータは残しています。',
        };
      }
    },
    save(state) {
      if (!validState(state)) return { ok: false, error: '入力データを保存できませんでした' };
      try {
        storageLike.setItem(STORAGE_KEY, JSON.stringify(state));
        return { ok: true, error: null };
      } catch {
        return { ok: false, error: '端末に保存できませんでした。空き容量とSafariの設定をご確認ください。' };
      }
    },
  };
}
