import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Japanese mobile app shell exposes three screens and entry form', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<html[^>]+lang="ja"/);
  assert.match(html, /name="viewport"[^>]+viewport-fit=cover/);
  for (const id of ['home-screen', 'history-screen', 'settings-screen', 'entry-dialog', 'entry-form', 'add-entry-button', 'toast']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /ホーム/);
  assert.match(html, /履歴/);
  assert.match(html, /設定/);
  assert.match(html, /src="\.\/js\/app\.js"/);
});
