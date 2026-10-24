# 累積残高と25日区切りレポート Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 月をまたいで引き継ぐ累積残高と、毎月25日〜翌月24日の支出合計・カテゴリ構成比を表示する。

**Architecture:** 日付期間、累積集計、カテゴリ構成比を `js/domain.js` の純粋関数として追加し、既存データを変えずに全記録から都度算出する。`js/app.js` はその結果をホームと履歴画面へ描画し、履歴の月移動を25日区切りの期間移動へ置き換える。

**Tech Stack:** HTML5、CSS3、Vanilla JavaScript ES Modules、Node.js `node:test`

**Spec:** `docs/superpowers/specs/2026-10-25-carryover-and-pay-cycle-report-design.md`

## Global Constraints

- 既存のローカルストレージ形式と保存済み記録を変更しない。
- 累積残高は全期間の記録から計算し、月替わりで0円へ戻さない。
- 1期間は毎月25日00:00から翌月24日までとする。
- 削除済みカテゴリも、記録に保存された `categoryName` で集計する。
- 外部ライブラリを追加しない。

## Review Focus

- 24日と25日の境界：24日は前期間、25日は新期間に分類するテストをTask 1へ追加する。
- 年越し：12月25日〜1月24日を同じ期間として抽出するテストをTask 1へ追加する。
- 未来期間：次期間へ移動しても範囲と空状態が壊れないテストをTask 1とTask 3へ追加する。
- 支出0円：構成比が空配列となり、`NaN` や0除算が発生しないテストをTask 2へ追加する。
- 同額カテゴリ：金額が同じ場合もカテゴリ名順で安定して表示されるテストをTask 2へ追加する。

---

### Task 1: 25日区切りの期間計算

**Files:**
- Modify: `js/domain.js`
- Modify: `tests/domain.test.mjs`

**Interfaces:**
- Produces: `cycleForDate(dateString: string): { key: string, start: string, end: string }`
- Produces: `cycleFromKey(key: string): { key: string, start: string, end: string }`
- Produces: `shiftCycle(key: string, offset: number): { key: string, start: string, end: string }`
- Produces: `entriesForCycle(entries: Entry[], cycle: { start: string, end: string }): Entry[]`
- `key` は期間開始月を示す `YYYY-MM` とする。

- [ ] **Step 1: 期間境界と年越しの失敗テストを書く**

```js
test('25日から翌24日までを同じ期間にする', () => {
  assert.deepEqual(cycleForDate('2026-10-25'), { key: '2026-10', start: '2026-10-25', end: '2026-11-24' });
  assert.equal(cycleForDate('2026-11-24').key, '2026-10');
  assert.equal(cycleForDate('2026-11-25').key, '2026-11');
});

test('年越し期間と前後移動を計算する', () => {
  assert.deepEqual(cycleFromKey('2026-12'), { key: '2026-12', start: '2026-12-25', end: '2027-01-24' });
  assert.equal(shiftCycle('2026-12', 1).key, '2027-01');
  assert.equal(shiftCycle('2026-01', -1).key, '2025-12');
});
```

- [ ] **Step 2: テストが未定義関数で失敗することを確認する**

Run: `node --test tests/domain.test.mjs`

Expected: FAIL because the cycle functions are not exported.

- [ ] **Step 3: `cycleForDate`, `cycleFromKey`, `shiftCycle`, `entriesForCycle` を `js/domain.js` に実装する**

文字列日付をローカル時刻へ変換せず、`YYYY-MM-DD` の年月日から期間境界を組み立てる。`entriesForCycle` は `start <= entry.date && entry.date <= end` の両端を含める。

- [ ] **Step 4: 対象外日付、空期間、未来期間の抽出テストを追加して全テストを通す**

Run: `node --test tests/domain.test.mjs`

Expected: all domain tests pass.

- [ ] **Step 5: コミットする**

```bash
git add js/domain.js tests/domain.test.mjs
git commit -m "feat: add 25th-day reporting periods"
```

### Task 2: 累積残高とカテゴリ構成比

**Files:**
- Modify: `js/domain.js`
- Modify: `tests/domain.test.mjs`

**Interfaces:**
- Consumes: existing `summarize(entries)`
- Produces: `expenseBreakdown(entries: Entry[]): Array<{ categoryName: string, amount: number, percentage: number }>`
- 累積残高は `summarize(allEntries).balance` を利用する。

- [ ] **Step 1: カテゴリ構成比の失敗テストを書く**

```js
test('支出をカテゴリ別に集計して金額順の構成比を返す', () => {
  const result = expenseBreakdown([
    { type: 'expense', amount: 3000, categoryName: '食費' },
    { type: 'expense', amount: 1000, categoryName: '交通' },
    { type: 'expense', amount: 1000, categoryName: '食費' },
    { type: 'income', amount: 9000, categoryName: '給与' },
  ]);
  assert.deepEqual(result, [
    { categoryName: '食費', amount: 4000, percentage: 80 },
    { categoryName: '交通', amount: 1000, percentage: 20 },
  ]);
});
```

- [ ] **Step 2: 未定義関数で失敗することを確認する**

Run: `node --test tests/domain.test.mjs`

Expected: FAIL because `expenseBreakdown` is not exported.

- [ ] **Step 3: `expenseBreakdown(entries)` を `js/domain.js` に実装する**

支出だけを `categoryName` ごとに合算し、総支出に対する `Math.round(amount / total * 100)` を返す。金額降順、同額なら日本語カテゴリ名順とする。支出0円は空配列を返す。

- [ ] **Step 4: 支出0円、削除済みカテゴリ名、同額カテゴリのテストを追加して全テストを通す**

Run: `node --test tests/domain.test.mjs`

Expected: all domain tests pass.

- [ ] **Step 5: コミットする**

```bash
git add js/domain.js tests/domain.test.mjs
git commit -m "feat: calculate cumulative balance and expense mix"
```

### Task 3: ホームと履歴レポートの表示更新

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `js/app.js`
- Modify: `tests/app-shell.test.mjs`
- Modify: `sw.js`

**Interfaces:**
- Consumes: `cycleForDate`, `cycleFromKey`, `shiftCycle`, `entriesForCycle`, `expenseBreakdown`, `summarize`
- Produces: DOM ID `expense-breakdown`, `report-period`
- Updates: `viewedMonth` を期間開始月キーとして利用する。

- [ ] **Step 1: 累積残高と構成比領域の失敗テストを書く**

`tests/app-shell.test.mjs` で、ホームに「現在の残高」「すべての収入 − すべての支出」があり、履歴画面に `report-period` と `expense-breakdown` が存在することを検証する。

- [ ] **Step 2: App Shellテストが失敗することを確認する**

Run: `node --test tests/app-shell.test.mjs`

Expected: FAIL because the new copy and IDs are absent.

- [ ] **Step 3: `index.html` と `styles.css` に累積残高・期間ラベル・構成比表示を実装する**

ホームの主カードは「現在の残高」、小カードは「この期間の収入／支出」に変更する。履歴には支出合計の下へ、カテゴリ名・金額・整数割合・横棒を表示するレスポンシブ領域を追加する。

- [ ] **Step 4: `js/app.js` のホームと履歴描画を25日区切りへ変更する**

ホームは `summarize(state.entries).balance` を主表示し、現在期間の収入・支出を小カードへ表示する。履歴は選択期間を `entriesForCycle` で抽出し、`expenseBreakdown` の各項目を安全なDOM APIで描画する。期間移動は `shiftCycle` を使う。

- [ ] **Step 5: Service Workerのキャッシュ名を `simple-kakeibo-shell-v2` に更新する**

変更後のJavaScriptとHTMLを既存インストールへ確実に届けるため、`sw.js` のキャッシュ版を更新する。

- [ ] **Step 6: 自動テスト、構文、静的配信を検証する**

Run: `node --test && node --check js/app.js && node --check sw.js && git diff --check`

Expected: all tests pass, syntax checks and whitespace check exit 0.

- [ ] **Step 7: コミットする**

```bash
git add index.html styles.css js/app.js tests/app-shell.test.mjs sw.js
git commit -m "feat: show carried balance and expense report"
```

### Task 4: 利用説明と最終検証

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: completed cumulative balance and reporting UI
- Produces: user-facing explanation of balance and reporting period

- [ ] **Step 1: READMEへ計算ルールを追記する**

「現在の残高」は登録開始以降の全収入−全支出であること、「月別レポート」は毎月25日〜翌月24日であること、登録以前の口座残高は含まれないことを記載する。

- [ ] **Step 2: 全テストとGit差分を最終確認する**

Run: `node --test && node --check js/domain.js && node --check js/storage.js && node --check js/app.js && node --check sw.js && git diff --check && git status --short`

Expected: all tests pass, syntax and whitespace checks exit 0, only README is uncommitted.

- [ ] **Step 3: コミットする**

```bash
git add README.md
git commit -m "docs: explain carried balance and pay-cycle reports"
```

- [ ] **Step 4: `main` へ統合後に再検証し、`origin/main` へプッシュする**

Run: `node --test && git push origin main`

Expected: all tests pass and push reports `main -> main`.
