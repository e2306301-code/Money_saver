# シンプル家計簿 PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iPhoneのSafariで収入・支出を素早く記録し、ホーム画面追加とオフライン利用ができる軽量な家計簿PWAを作る。

**Architecture:** ビルド不要のHTML/CSS/ES Modulesで構成し、計算・検証を純粋関数、永続化をローカルストレージ用モジュール、DOM操作をアプリモジュールへ分離する。Service Workerが静的ファイルをキャッシュし、重要なロジックとPWA構成はNode標準テストで検証する。

**Tech Stack:** HTML5、CSS3、Vanilla JavaScript ES Modules、Web App Manifest、Service Worker、Node.js `node:test`

**Spec:** `docs/superpowers/specs/2026-09-15-simple-household-budget-design.md`

## Global Constraints

- iPhoneのSafariを主対象とする。
- ホーム画面に追加できるPWAとし、初回表示後はオフラインでも基本機能を利用可能にする。
- サーバー、ユーザー登録、ログイン、外部ライブラリ、外部フォントを使用しない。
- データはブラウザのローカルストレージだけに保存する。
- 初版に予算、グラフ、銀行連携、クラウド同期、CSV入出力を含めない。
- 金額は1円以上の整数とする。
- 収入と支出を色だけで区別せず、日本語ラベルと記号を併用する。

---

## File Structure

- `index.html`: アプリの意味構造、3画面、記録モーダル、通知領域。
- `styles.css`: モバイルファーストの見た目、セーフエリア、ダークモード、操作状態。
- `js/domain.js`: 初期カテゴリ、入力検証、月間抽出・集計、並び替え。
- `js/storage.js`: バージョン付きJSONの読み書き、破損データ保護、初期状態生成。
- `js/app.js`: DOM描画、ナビゲーション、フォーム、カテゴリ管理、イベント処理。
- `manifest.webmanifest`: PWA名、表示形式、テーマ、アイコン定義。
- `sw.js`: App Shellのキャッシュとオフライン応答。
- `icons/icon.svg`: アプリ用ベクターアイコン。
- `icons/icon-192.png`, `icons/icon-512.png`: インストール用PNGアイコン。
- `tests/domain.test.mjs`: 検証、集計、月抽出、カテゴリ動作の単体テスト。
- `tests/storage.test.mjs`: 保存、復元、破損データ処理の単体テスト。
- `tests/app-shell.test.mjs`: HTML、Manifest、Service Workerの構成テスト。
- `package.json`: Node標準テストの実行コマンドとES Module設定。
- `s.html`: 空の旧ファイルなので削除する。

### Task 1: 家計簿ドメインと月間集計

**Files:**
- Create: `package.json`
- Create: `js/domain.js`
- Create: `tests/domain.test.mjs`

**Interfaces:**
- Produces: `DEFAULT_CATEGORIES: Category[]`
- Produces: `validateEntry(input): { valid: boolean, errors: Record<string, string>, value?: EntryInput }`
- Produces: `entriesForMonth(entries, monthKey): Entry[]`
- Produces: `summarize(entries): { income: number, expense: number, balance: number }`
- Produces: `sortEntriesNewest(entries): Entry[]`
- `Category = { id: string, type: 'income'|'expense', name: string, builtIn: boolean }`
- `Entry = { id: string, type: 'income'|'expense', amount: number, categoryId: string, categoryName: string, memo: string, date: string, createdAt: string, updatedAt: string }`

- [ ] **Step 1: テストランナーを定義する**

```json
{
  "name": "simple-household-budget",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
```

- [ ] **Step 2: 入力検証と集計の失敗テストを書く**

`tests/domain.test.mjs` に、次を具体値で追加する。

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { entriesForMonth, summarize, validateEntry } from '../js/domain.js';

test('1円未満、小数、未選択カテゴリ、不正日付を拒否する', () => {
  const result = validateEntry({ type: 'expense', amount: '0.5', categoryId: '', date: 'bad', memo: '' });
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['amount', 'categoryId', 'date']);
});

test('対象月だけを集計して差額を返す', () => {
  const entries = [
    { id: '1', type: 'income', amount: 200000, date: '2026-09-01' },
    { id: '2', type: 'expense', amount: 1200, date: '2026-09-02' },
    { id: '3', type: 'expense', amount: 500, date: '2026-08-31' }
  ];
  assert.deepEqual(summarize(entriesForMonth(entries, '2026-09')), {
    income: 200000,
    expense: 1200,
    balance: 198800
  });
});
```

- [ ] **Step 3: テストが期待どおり失敗することを確認する**

Run: `npm test`

Expected: `ERR_MODULE_NOT_FOUND` for `js/domain.js`.

- [ ] **Step 4: ドメイン関数を実装する**

`js/domain.js` に初期カテゴリを定義し、`Number.isSafeInteger(amount) && amount >= 1`、`/^\d{4}-\d{2}-\d{2}$/` と実在日チェック、種別とカテゴリの必須検証を実装する。`entriesForMonth` は `entry.date.slice(0, 7) === monthKey`、`summarize` は収入と支出を別々に加算し、`balance = income - expense` を返す。`sortEntriesNewest` は日付降順、同日なら作成日時降順の新しい配列を返す。

- [ ] **Step 5: 正常入力、並び順、初期カテゴリの追加テストを書く**

```js
test('正常入力は数値化されメモの前後空白が除去される', () => {
  const result = validateEntry({ type: 'income', amount: '1000', categoryId: 'income-salary', date: '2026-09-15', memo: ' 給料 ' });
  assert.equal(result.valid, true);
  assert.deepEqual(result.value, { type: 'income', amount: 1000, categoryId: 'income-salary', date: '2026-09-15', memo: '給料' });
});
```

- [ ] **Step 6: 全テストを通す**

Run: `npm test`

Expected: all domain tests pass.

- [ ] **Step 7: コミットする**

```bash
git add package.json js/domain.js tests/domain.test.mjs
git commit -m "feat: add household budget domain logic"
```

### Task 2: 安全な端末内保存とカテゴリ管理

**Files:**
- Create: `js/storage.js`
- Create: `tests/storage.test.mjs`
- Modify: `js/domain.js`
- Modify: `tests/domain.test.mjs`

**Interfaces:**
- Consumes: `DEFAULT_CATEGORIES` from `js/domain.js`
- Produces: `createInitialState(): AppState`
- Produces: `createStorage(storageLike): { load(): LoadResult, save(state): SaveResult }`
- Produces: `addCategory(categories, { type, name }, idFactory): { categories: Category[], error: string|null }`
- Produces: `removeCustomCategory(categories, id): { categories: Category[], error: string|null }`
- `AppState = { version: 1, entries: Entry[], categories: Category[] }`
- `LoadResult = { state: AppState, recovered: boolean, error: string|null }`
- `SaveResult = { ok: boolean, error: string|null }`

- [ ] **Step 1: 保存と破損復旧の失敗テストを書く**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, createStorage } from '../js/storage.js';

const memoryStorage = (initial = {}) => ({
  data: { ...initial },
  getItem(key) { return this.data[key] ?? null; },
  setItem(key, value) { this.data[key] = value; }
});

test('未保存なら初期カテゴリ付き状態を返す', () => {
  const result = createStorage(memoryStorage()).load();
  assert.equal(result.state.version, 1);
  assert.ok(result.state.categories.some(category => category.name === '食費'));
});

test('壊れたJSONは上書きせず復旧状態を通知する', () => {
  const storage = memoryStorage({ 'simple-kakeibo:v1': '{broken' });
  const result = createStorage(storage).load();
  assert.equal(result.recovered, true);
  assert.match(result.error, /読み込めませんでした/);
  assert.equal(storage.data['simple-kakeibo:v1'], '{broken');
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/storage.test.mjs`

Expected: `ERR_MODULE_NOT_FOUND` for `js/storage.js`.

- [ ] **Step 3: バージョン付き保存を実装する**

キーを `simple-kakeibo:v1` に固定する。`load()` は未保存時に `createInitialState()`、正常時に構造を検証した状態、JSON解析または構造検証失敗時に初期状態と案内を返す。`save()` は `JSON.stringify` と `setItem` を `try/catch` し、日本語エラーを返す。読み込み失敗時に `setItem` を呼ばない。

- [ ] **Step 4: カテゴリ追加・削除の失敗テストを書く**

`tests/domain.test.mjs` に同種別で大文字小文字と前後空白を無視した重複を拒否するテスト、空名を拒否するテスト、独自カテゴリを削除できるテスト、初期カテゴリ削除を拒否するテストを追加する。

```js
const duplicate = addCategory(DEFAULT_CATEGORIES, { type: 'expense', name: ' 食費 ' }, () => 'new-id');
assert.match(duplicate.error, /すでにあります/);
const builtIn = removeCustomCategory(DEFAULT_CATEGORIES, 'expense-food');
assert.match(builtIn.error, /削除できません/);
```

- [ ] **Step 5: カテゴリ関数を実装する**

`addCategory` は名前をtrimし、空文字と同種別の重複を拒否して `{ id: idFactory(), type, name, builtIn: false }` を追加する。`removeCustomCategory` は存在しないIDまたは `builtIn: true` を拒否し、独自カテゴリだけを除外した新配列を返す。

- [ ] **Step 6: 全テストを通す**

Run: `npm test`

Expected: all domain and storage tests pass.

- [ ] **Step 7: コミットする**

```bash
git add js/domain.js js/storage.js tests/domain.test.mjs tests/storage.test.mjs
git commit -m "feat: persist entries and manage categories"
```

### Task 3: モバイル画面と記録操作

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `js/app.js`
- Create: `tests/app-shell.test.mjs`
- Delete: `s.html`

**Interfaces:**
- Consumes: `validateEntry`, `entriesForMonth`, `summarize`, `sortEntriesNewest`, `addCategory`, `removeCustomCategory` from `js/domain.js`
- Consumes: `createStorage(window.localStorage)` from `js/storage.js`
- Produces: DOM IDs `home-screen`, `history-screen`, `settings-screen`, `entry-dialog`, `entry-form`, `add-entry-button`, `toast`
- Produces: user flows for add/edit/delete entry, month navigation, and add/delete custom category

- [ ] **Step 1: App Shellの失敗テストを書く**

`tests/app-shell.test.mjs` は `node:fs/promises` で `index.html` を読み、lang、viewport、theme-color、manifest link、上記DOM ID、`type="module" src="./js/app.js"`、3つのナビゲーションラベルが存在することを正規表現で検証する。

```js
test('主要画面と入力ダイアログがある', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['home-screen', 'history-screen', 'settings-screen', 'entry-dialog', 'entry-form', 'add-entry-button', 'toast']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /<html[^>]+lang=["']ja["']/);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/app-shell.test.mjs`

Expected: `ENOENT` for `index.html`.

- [ ] **Step 3: セマンティックなHTMLを作る**

`index.html` に、今月の3指標、最近の記録、月移動付き履歴、カテゴリ設定、下部ナビゲーション、追加ボタン、`<dialog>` の記録フォームを作る。すべての入力にlabelを関連付け、エラー表示は `aria-live`、通知は `role="status"`、削除確認は別の`<dialog>`にする。

- [ ] **Step 4: iPhone向けスタイルを作る**

`styles.css` に `viewport-fit=cover` と組み合わせる `env(safe-area-inset-*)`、44px以上の操作領域、下部固定ナビ、金額中心のフォーム、カード、空状態、フォーカス表示、`prefers-color-scheme: dark`、`prefers-reduced-motion: reduce` を実装する。収入は `＋ 収入`、支出は `− 支出` の文字と記号も表示する。

- [ ] **Step 5: 画面描画と記録CRUDを実装する**

`js/app.js` で起動時に保存状態を読み、当月キーを生成して描画する。追加時は `crypto.randomUUID()` とISO日時を付与し、編集時はID・作成日時を維持して更新日時だけ変更する。削除は確認ダイアログ後に実行する。保存が成功した場合だけ画面状態を確定し、失敗時は元の状態を維持してtoastを表示する。

- [ ] **Step 6: 月移動とカテゴリ管理を実装する**

月移動は年越しを含め `new Date(year, month ± 1, 1)` で処理する。設定画面では収入・支出別にカテゴリを描画し、追加フォームを処理する。独自カテゴリの削除後も記録は `categoryName` を使って表示する。削除したカテゴリを参照する記録の編集時は保存済みカテゴリ名を一時選択肢として提示する。

- [ ] **Step 7: App Shellと全ロジックテストを通す**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 8: コミットする**

```bash
git add index.html styles.css js/app.js tests/app-shell.test.mjs s.html
git commit -m "feat: add mobile household budget interface"
```

### Task 4: PWAインストールとオフライン対応

**Files:**
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Create: `icons/icon.svg`
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `tests/app-shell.test.mjs`

**Interfaces:**
- Produces: manifest `start_url: "./"`, `display: "standalone"`, 192px and 512px icons
- Produces: cache `simple-kakeibo-shell-v1` containing all local runtime assets
- Produces: Service Worker registration from `js/app.js`

- [ ] **Step 1: PWA構成の失敗テストを書く**

`tests/app-shell.test.mjs` にManifestをJSONとして読み、`name === 'つづく家計簿'`、`display === 'standalone'`、192/512アイコンを検証するテストを追加する。`sw.js`を読み、App Shellの各パスとキャッシュ名を含むこと、`js/app.js`に `navigator.serviceWorker.register('./sw.js')` があることを検証する。

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/app-shell.test.mjs`

Expected: `ENOENT` for `manifest.webmanifest` or `sw.js`.

- [ ] **Step 3: Manifestとアイコンを作る**

Manifestは短い名前を「家計簿」、説明を「毎日かんたんに続けられる、端末保存の家計簿」、背景色とテーマ色を画面CSSと一致させる。`icon.svg` は角丸背景に財布とチェック印の単純な図形とし、macOS `sips` または利用可能な画像変換ツールで同じ絵柄の192px/512px PNGを生成する。`index.html` にmanifest、favicon、apple-touch-iconを関連付ける。

- [ ] **Step 4: Service Workerを実装する**

install時に `./`, `./index.html`, `./styles.css`, `./js/app.js`, `./js/domain.js`, `./js/storage.js`, Manifest、3アイコンをキャッシュする。activate時に `simple-kakeibo-shell-v1` 以外の同プレフィックスキャッシュを削除する。GETリクエストはcache-firstで応答し、未キャッシュ時はnetworkを使う。

- [ ] **Step 5: Service Worker登録を実装する**

`js/app.js` の画面初期化後に、`'serviceWorker' in navigator` ならwindow load時に `navigator.serviceWorker.register('./sw.js')` を実行する。登録失敗は家計データの利用を妨げないためconsole warningに留める。

- [ ] **Step 6: 全テストを通す**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 7: コミットする**

```bash
git add index.html js/app.js manifest.webmanifest sw.js icons tests/app-shell.test.mjs
git commit -m "feat: make household budget installable offline"
```

### Task 5: 実機相当の確認と仕上げ

**Files:**
- Modify: `README.md` if usage guidance is missing
- Modify: files found defective during verification only

**Interfaces:**
- Consumes: completed PWA from Tasks 1-4
- Produces: verified mobile and offline user experience

- [ ] **Step 1: 自動検証を実行する**

Run: `npm test`

Expected: zero failures.

Run: `node --check js/domain.js && node --check js/storage.js && node --check js/app.js && node --check sw.js`

Expected: no output and exit code 0.

- [ ] **Step 2: ローカルHTTPサーバーで表示する**

Run: `python3 -m http.server 4173`

Expected: `Serving HTTP on ... port 4173` and `http://localhost:4173/` returns status 200.

- [ ] **Step 3: 390×844相当で主要フローを確認する**

ブラウザをiPhone 13相当のviewportにし、支出1,200円と収入200,000円を登録する。ホームが収入200,000円、支出1,200円、差額198,800円を示すこと、履歴に2件あること、編集後に再集計されること、削除確認をキャンセルできることを確認する。

- [ ] **Step 4: カテゴリと永続化を確認する**

支出カテゴリ「医療費」を追加して記録し、カテゴリを削除する。既存記録に「医療費」が残ること、再読み込み後も記録が残ること、初期カテゴリは削除できないことを確認する。

- [ ] **Step 5: オフラインとレイアウトを確認する**

Service Workerがactiveになった後にofflineへ切り替えて再読み込みする。3画面が表示され記録操作ができること、390px幅で横スクロール・下部ナビの重なり・切れた文字がないこと、ダークモードでも読めることを確認する。

- [ ] **Step 6: 使い方を記載する**

`README.md` にローカル起動コマンド、iPhoneでHTTPS公開URLを開いて「共有」→「ホーム画面に追加」する手順、データが端末内Safariにだけ保存されSafariデータ削除で消える注意点を記載する。

- [ ] **Step 7: 最終検証とコミットを行う**

Run: `npm test && git diff --check && git status --short`

Expected: tests pass, no whitespace errors, only intended final files are modified.

```bash
git add README.md index.html styles.css js manifest.webmanifest sw.js icons tests package.json
git commit -m "docs: add setup and iPhone usage guide"
```
