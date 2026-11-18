import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appEnvFiles = ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local', '.env.test', '.env.test.local'];
const localPathKeys = new Set(['DEMO_DATA_FILE', 'BOT_STATE_FILE', 'STATIC_DIR']);
const processStateFiles = new Set(['managed-services.json', 'services.lock']);

async function exists(path) {
  try { await stat(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

// При переносе .env относительные пути вне .local сохраняют прежний смысл.
// Значения секретов не разбираются, не печатаются и не подставляются в команды.
function relocatePaths(contents, repositoryRoot) {
  return contents.replace(/^(\s*(?:export\s+)?([A-Z_]+)\s*=)([^\r\n]*)/gm, (line, prefix, name, raw) => {
    if (!localPathKeys.has(name)) return line;
    let value = raw.trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0];
      const end = value.indexOf(quote, 1);
      if (end < 0) return line;
      value = value.slice(1, end);
    } else value = value.split('#', 1)[0].trim();
    if (!value || isAbsolute(value) || /^\.local(?:[\\/]|$)/.test(value)) return line;
    const absolute = resolve(repositoryRoot, value).replaceAll('\\', '/');
    return `${prefix}${JSON.stringify(absolute)}`;
  });
}

async function copyPrivateState(source, destination, report, topLevel = true) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (topLevel && processStateFiles.has(entry.name)) continue;
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isSymbolicLink()) {
      report.skippedLinks++;
      continue;
    }
    if (entry.isDirectory()) await copyPrivateState(from, to, report, false);
    else if (entry.isFile()) {
      try { await copyFile(from, to, constants.COPYFILE_EXCL); report.copiedStateFiles++; }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
  }
}

export async function prepareLocal(repositoryRoot, log = console.log) {
  const root = resolve(repositoryRoot);
  const project = join(root, 'Project');
  const example = join(project, '.env.example');
  if (!await exists(join(project, 'package.json')) || !await exists(example)) {
    throw new Error('Не найден Project/package.json или Project/.env.example. Запускайте скрипт из репозитория Klan.');
  }
  const report = { createdEnv: false, migratedEnv: [], copiedStateFiles: 0, skippedLinks: 0 };

  // Старые настройки остаются резервной копией. Уже подготовленные файлы
  // Project никогда не заменяются, включая повторный запуск этой команды.
  for (const name of appEnvFiles) {
    const source = join(root, name);
    if (!await exists(source) || await exists(join(project, name))) continue;
    const text = relocatePaths(await readFile(source, 'utf8'), root);
    try {
      await writeFile(join(project, name), text, { flag: 'wx', mode: 0o600 });
      report.migratedEnv.push(name);
    } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }

  const oldState = join(root, '.local');
  if (await exists(oldState)) {
    await copyPrivateState(oldState, join(project, '.local'), report);
  }
  const oldComposeEnv = join(root, '.env.compose');
  if (await exists(oldComposeEnv) && await exists(join(root, 'Docker'))) {
    try { await copyFile(oldComposeEnv, join(root, 'Docker', '.env'), constants.COPYFILE_EXCL); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  if (!await exists(join(project, '.env'))) {
    try {
      await writeFile(join(project, '.env'), await readFile(example), { flag: 'wx', mode: 0o600 });
      report.createdEnv = true;
    } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }

  if (report.migratedEnv.length || report.copiedStateFiles) {
    log('Старые локальные настройки скопированы в Project; исходные файлы сохранены как резервные.');
    log('Перед сменой структуры остановите старые процессы. Их PID и блокировки не переносятся.');
  }
  if (report.createdEnv) log('Создан Project/.env. Заполните необходимые параметры перед запуском.');
  if (report.skippedLinks) log('Символические ссылки в прежней .local оставлены на месте; проверьте используемые внешние пути.');
  log(`Локальная конфигурация: ${relative(root, join(project, '.env')).replaceAll('\\', '/')}`);
  return report;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  prepareLocal(resolve(dirname(currentFile), '..')).catch(() => {
    console.error('Не удалось подготовить локальные настройки. Проверьте доступ к Project и прежней .local. Исходные файлы не удалены.');
    process.exitCode = 1;
  });
}
