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

test('install manifest points to standalone app and usable icons', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'つづく家計簿');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  for (const icon of manifest.icons) assert.ok((await readFile(new URL(`../${icon.src}`, import.meta.url))).length > 100);
});

test('service worker can cache every runtime file', async () => {
  const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  for (const path of ['./index.html', './styles.css', './js/app.js', './js/domain.js', './js/storage.js', './manifest.webmanifest']) {
    assert.ok(source.includes(path), `${path} is missing from cache list`);
  }
});
