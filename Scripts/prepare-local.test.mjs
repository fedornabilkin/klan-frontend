import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { prepareLocal } from './prepare-local.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'klan-layout-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'Project'));
  await mkdir(join(root, 'Docker'));
  await writeFile(join(root, 'Project/package.json'), '{}');
  await writeFile(join(root, 'Project/.env.example'), 'TELEGRAM_BOT_TOKEN=\nBOT_STATE_FILE=.local/offset.json\n');
  return root;
}

test('создаёт приватный .env и сохраняет введённый токен при повторном запуске', async t => {
  const root = await fixture(t);
  assert.equal((await prepareLocal(root, () => {})).createdEnv, true);
  const file = join(root, 'Project/.env');
  assert.match(await readFile(file, 'utf8'), /^TELEGRAM_BOT_TOKEN=\n/);
  if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o777, 0o600);
  await writeFile(file, 'TELEGRAM_BOT_TOKEN=SYNTHETIC_LOCAL_VALUE\n');
  await prepareLocal(root, () => {});
  assert.equal(await readFile(file, 'utf8'), 'TELEGRAM_BOT_TOKEN=SYNTHETIC_LOCAL_VALUE\n');
});

test('переносит настройки и offset без потери данных и без копирования PID', async t => {
  const root = await fixture(t);
  await mkdir(join(root, '.local'));
  const original = 'TELEGRAM_BOT_TOKEN=SYNTHETIC_LEGACY_VALUE\nBOT_STATE_FILE=.local/offset.json\n';
  await writeFile(join(root, '.env'), original);
  await writeFile(join(root, '.local/offset.json'), '{"offset":123}');
  await writeFile(join(root, '.local/postgres.json'), '{"port":5433}');
  await writeFile(join(root, '.local/managed-services.json'), '{"pid":1}');
  await writeFile(join(root, '.local/services.lock'), 'locked');
  const messages = [];
  const result = await prepareLocal(root, value => messages.push(value));
  assert.equal(result.copiedStateFiles, 2);
  assert.equal(await readFile(join(root, 'Project/.env'), 'utf8'), original);
  assert.equal(await readFile(join(root, '.env'), 'utf8'), original);
  assert.equal(await readFile(join(root, 'Project/.local/offset.json'), 'utf8'), '{"offset":123}');
  await assert.rejects(stat(join(root, 'Project/.local/managed-services.json')), { code: 'ENOENT' });
  await assert.rejects(stat(join(root, 'Project/.local/services.lock')), { code: 'ENOENT' });
  assert.ok(messages.every(message => !message.includes('SYNTHETIC_LEGACY_VALUE')));
  await writeFile(join(root, 'Project/.local/offset.json'), '{"offset":456}');
  await prepareLocal(root, () => {});
  assert.equal(await readFile(join(root, 'Project/.local/offset.json'), 'utf8'), '{"offset":456}');
});

test('сохраняет смысл внешних относительных путей и не заменяет существующий .env', async t => {
  const root = await fixture(t);
  await writeFile(join(root, '.env'), 'DEMO_DATA_FILE=../private/demo.json\nSTATIC_DIR="../site/dist"\n');
  await writeFile(join(root, '.env.local'), 'VITE_DEV_PORT=5174\n');
  await writeFile(join(root, '.env.compose'), 'POSTGRES_PASSWORD=EXAMPLE_VALUE\n');
  await prepareLocal(root, () => {});
  const current = await readFile(join(root, 'Project/.env'), 'utf8');
  assert.ok(current.includes(resolve(root, '../private/demo.json').replaceAll('\\', '/')));
  assert.ok(current.includes(resolve(root, '../site/dist').replaceAll('\\', '/')));
  assert.equal(await readFile(join(root, 'Project/.env.local'), 'utf8'), 'VITE_DEV_PORT=5174\n');
  assert.equal(await readFile(join(root, 'Docker/.env'), 'utf8'), 'POSTGRES_PASSWORD=EXAMPLE_VALUE\n');
  await writeFile(join(root, '.env'), 'DEMO_DATA_FILE=../changed.json\n');
  await prepareLocal(root, () => {});
  assert.equal(await readFile(join(root, 'Project/.env'), 'utf8'), current);
});
