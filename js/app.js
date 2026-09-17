import { addCategory, entriesForMonth, removeCustomCategory, sortEntriesNewest, summarize, validateEntry } from './domain.js';
import { createStorage } from './storage.js';

const $ = id => document.getElementById(id);
const storage = createStorage(window.localStorage);
const loaded = storage.load();
let state = loaded.state;
let dataLocked = loaded.recovered;
let activeScreen = 'home';
let viewedMonth = monthKey(new Date());
let editingId = null;
let pendingDelete = null;
let toastTimer;

const yen = value => `¥${Math.abs(value).toLocaleString('ja-JP')}`;
const signedYen = value => `${value < 0 ? '−' : ''}${yen(value)}`;

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKey(date) { return localDate(date).slice(0, 7); }
function monthLabel(key) { const [year, month] = key.split('-'); return `${year}年${Number(month)}月`; }
function dateLabel(value) { const [, month, day] = value.split('-'); return `${Number(month)}月${Number(day)}日`; }

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3800);
}

function saveState(next, message) {
  if (dataLocked) { showToast('保存データを保護中です。新しい記録は保存できません。'); return false; }
  const result = storage.save(next);
  if (!result.ok) { showToast(result.error); return false; }
  state = next;
  render();
  if (message) showToast(message);
  return true;
}

function emptyState(title, description) {
  const box = document.createElement('div');
  box.className = 'empty-state';
  const icon = document.createElement('div');
  icon.className = 'empty-illustration';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '✎';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const text = document.createElement('p');
  text.textContent = description;
  box.append(icon, heading, text);
  return box;
}

function makeEntryRow(entry) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `entry-row ${entry.type}`;
  button.setAttribute('aria-label', `${dateLabel(entry.date)} ${entry.categoryName} ${entry.type === 'income' ? '収入' : '支出'} ${yen(entry.amount)}。編集する`);
  const avatar = document.createElement('span');
  avatar.className = 'entry-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = entry.type === 'income' ? '＋' : '−';
  const info = document.createElement('span');
  info.className = 'entry-info';
  const name = document.createElement('strong');
  name.textContent = entry.categoryName;
  const detail = document.createElement('small');
  detail.textContent = `${dateLabel(entry.date)}${entry.memo ? ` · ${entry.memo}` : ''}`;
  info.append(name, detail);
  const amount = document.createElement('span');
  amount.className = 'entry-amount';
  amount.textContent = `${entry.type === 'income' ? '＋' : '−'} ${yen(entry.amount)}`;
  button.append(avatar, info, amount);
  button.addEventListener('click', () => openEntry(entry));
  return button;
}

function renderEntries(container, entries, title) {
  container.replaceChildren();
  if (!entries.length) {
    container.append(emptyState(title, '「＋」から記録してみましょう。'));
    return;
  }
  entries.forEach(entry => container.append(makeEntryRow(entry)));
}

function renderHome() {
  const currentMonth = monthKey(new Date());
  const entries = sortEntriesNewest(entriesForMonth(state.entries, currentMonth));
  const total = summarize(entries);
  $('home-month').textContent = `${monthLabel(currentMonth)}のまとめ`;
  $('home-balance').textContent = signedYen(total.balance);
  $('home-income').textContent = yen(total.income);
  $('home-expense').textContent = yen(total.expense);
  renderEntries($('recent-list'), entries.slice(0, 5), '今月はまだ記録がありません');
}

function renderHistory() {
  const entries = sortEntriesNewest(entriesForMonth(state.entries, viewedMonth));
  const total = summarize(entries);
  $('history-month').textContent = monthLabel(viewedMonth);
  $('history-income').textContent = yen(total.income);
  $('history-expense').textContent = yen(total.expense);
  $('history-balance').textContent = signedYen(total.balance);
  $('history-count').textContent = `${entries.length}件`;
  renderEntries($('history-list'), entries, 'この月の記録はありません');
}

function renderCategoryGroup(type, container) {
  container.replaceChildren();
  state.categories.filter(category => category.type === type).forEach(category => {
    const chip = document.createElement('div');
    chip.className = 'category-chip';
    const label = document.createElement('span');
    label.textContent = category.name;
    chip.append(label);
    if (!category.builtIn) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `${category.name}を削除`);
      remove.addEventListener('click', () => confirmRemoval(`「${category.name}」を削除しますか？`, '記録に表示されるカテゴリ名は残ります。', () => {
        const result = removeCustomCategory(state.categories, category.id);
        if (result.error) return showToast(result.error);
        saveState({ ...state, categories: result.categories }, 'カテゴリを削除しました');
      }));
      chip.append(remove);
    }
    container.append(chip);
  });
}

function render() {
  renderHome();
  renderHistory();
  renderCategoryGroup('expense', $('expense-categories'));
  renderCategoryGroup('income', $('income-categories'));
  $('header-date').textContent = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());
}

function navigate(screen) {
  if (!['home', 'history', 'settings'].includes(screen)) return;
  activeScreen = screen;
  for (const name of ['home', 'history', 'settings']) {
    $(`${name}-screen`).hidden = name !== screen;
  }
  document.querySelectorAll('[data-screen]').forEach(button => {
    const selected = button.dataset.screen === screen;
    button.classList.toggle('is-active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function setEntryType(type, selectedId = '') {
  $('entry-type').value = type;
  document.querySelectorAll('[data-type]').forEach(button => button.classList.toggle('is-selected', button.dataset.type === type));
  const select = $('entry-category');
  select.replaceChildren();
  const prompt = document.createElement('option');
  prompt.value = '';
  prompt.textContent = '選択してください';
  select.append(prompt);
  state.categories.filter(category => category.type === type).forEach(category => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    select.append(option);
  });
  if (selectedId && !state.categories.some(category => category.id === selectedId)) {
    const old = state.entries.find(entry => entry.id === editingId);
    if (old && old.categoryId === selectedId && old.type === type) {
      const option = document.createElement('option');
      option.value = selectedId;
      option.textContent = `${old.categoryName}（削除済み）`;
      select.append(option);
    }
  }
  select.value = selectedId || '';
}

function clearEntryErrors() {
  for (const id of ['amount-error', 'category-id-error', 'date-error']) $(id).textContent = '';
}

function openEntry(entry = null) {
  if (dataLocked) return showToast('保存データを読み込めないため、記録を追加できません');
  editingId = entry?.id ?? null;
  $('entry-form').reset();
  clearEntryErrors();
  $('entry-dialog-title').textContent = entry ? '記録を編集' : '記録を追加';
  $('delete-entry').hidden = !entry;
  setEntryType(entry?.type ?? 'expense', entry?.categoryId ?? '');
  $('entry-amount').value = entry ? String(entry.amount) : '';
  $('entry-date').value = entry?.date ?? localDate();
  $('entry-memo').value = entry?.memo ?? '';
  $('entry-dialog').showModal();
  setTimeout(() => $('entry-amount').focus(), 40);
}

function closeEntry() { $('entry-dialog').close(); editingId = null; }

function confirmRemoval(title, message, action) {
  $('confirm-title').textContent = title;
  $('confirm-message').textContent = message;
  pendingDelete = action;
  $('confirm-dialog').showModal();
}

function changeViewedMonth(offset) {
  const [year, month] = viewedMonth.split('-').map(Number);
  viewedMonth = monthKey(new Date(year, month - 1 + offset, 1));
  renderHistory();
}

document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.screen)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
document.querySelectorAll('[data-type]').forEach(button => button.addEventListener('click', () => setEntryType(button.dataset.type)));
$('add-entry-button').addEventListener('click', () => openEntry());
$('close-entry').addEventListener('click', closeEntry);
$('previous-month').addEventListener('click', () => changeViewedMonth(-1));
$('next-month').addEventListener('click', () => changeViewedMonth(1));
$('cancel-delete').addEventListener('click', () => { pendingDelete = null; $('confirm-dialog').close(); });
$('confirm-delete').addEventListener('click', () => {
  const action = pendingDelete;
  pendingDelete = null;
  $('confirm-dialog').close();
  action?.();
});
$('confirm-dialog').addEventListener('close', () => { pendingDelete = null; });
$('delete-entry').addEventListener('click', () => {
  const id = editingId;
  confirmRemoval('この記録を削除しますか？', '削除すると元に戻せません。', () => {
    if (saveState({ ...state, entries: state.entries.filter(entry => entry.id !== id) }, '記録を削除しました')) closeEntry();
  });
});

$('entry-form').addEventListener('submit', event => {
  event.preventDefault();
  clearEntryErrors();
  const result = validateEntry({
    type: $('entry-type').value,
    amount: $('entry-amount').value,
    categoryId: $('entry-category').value,
    date: $('entry-date').value,
    memo: $('entry-memo').value,
  });
  if (!result.valid) {
    $('amount-error').textContent = result.errors.amount ?? '';
    $('category-id-error').textContent = result.errors.categoryId ?? '';
    $('date-error').textContent = result.errors.date ?? '';
    const first = result.errors.amount ? $('entry-amount') : result.errors.categoryId ? $('entry-category') : $('entry-date');
    first.focus();
    return;
  }
  const value = result.value;
  const old = state.entries.find(entry => entry.id === editingId);
  const category = state.categories.find(item => item.id === value.categoryId && item.type === value.type);
  if (!category && !(old && old.categoryId === value.categoryId && old.type === value.type)) {
    $('category-id-error').textContent = 'カテゴリを選び直してください';
    $('entry-category').focus();
    return;
  }
  const now = new Date().toISOString();
  const entry = {
    id: old?.id ?? crypto.randomUUID(), ...value,
    categoryName: category?.name ?? old.categoryName,
    createdAt: old?.createdAt ?? now,
    updatedAt: now,
  };
  const entries = old ? state.entries.map(item => item.id === old.id ? entry : item) : [...state.entries, entry];
  if (saveState({ ...state, entries }, old ? '記録を更新しました' : '記録を保存しました')) closeEntry();
});

$('category-form').addEventListener('submit', event => {
  event.preventDefault();
  $('category-error').textContent = '';
  const result = addCategory(state.categories, { type: $('category-type').value, name: $('category-name').value }, () => crypto.randomUUID());
  if (result.error) { $('category-error').textContent = result.error; $('category-name').focus(); return; }
  if (saveState({ ...state, categories: result.categories }, 'カテゴリを追加しました')) {
    $('category-name').value = '';
    $('category-name').focus();
  }
});

render();
if (loaded.error) {
  $('add-entry-button').disabled = true;
  $('category-form').querySelector('button[type="submit"]').disabled = true;
  showToast(loaded.error);
}
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(error => console.warn('オフライン登録に失敗しました', error)));
}
