import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const deployDirectory = dirname(fileURLToPath(import.meta.url));
const bash = process.env.DEPLOY_TEST_BASH || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
const bashEnvironment = { ...process.env, MSYS: 'winsymlinks:lnk' };
const probe = spawnSync(bash, ['--version'], { env: bashEnvironment, encoding: 'utf8' });
const unavailable = probe.status !== 0 ? 'Bash unavailable; run on Linux or allow Git Bash on Windows' : false;
const realRsync = process.env.DEPLOY_TEST_RSYNC ? shellPath(process.env.DEPLOY_TEST_RSYNC)
  : spawnSync(bash, ['-c', 'command -v rsync'], { env: bashEnvironment, encoding: 'utf8' }).stdout?.trim() || '';
const oldSha = 'a'.repeat(40), newSha = 'b'.repeat(40);
const oldId = oldSha + '-1-1', newId = newSha + '-2-1';

function shellPath(value) {
  const absolute = resolve(value).replaceAll('\\', '/');
  return process.platform === 'win32' ? absolute.replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase()) : absolute;
}
function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, { mode: 0o600 });
}
test('shared nginx tuning preserves other sites and restores the config on reload failure', { skip: unavailable }, context => {
  const root = mkdtempSync(join(tmpdir(), 'klan-capacity-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const config = join(root, 'nginx.conf'), script = join(root, 'tune.sh');
  const original = 'worker_processes auto;\nevents {\n  worker_connections 768; # existing\n}\nhttp { include sites-enabled/*; }\n';
  const code = readFileSync(join(deployDirectory, 'configure-connections.sh'), 'utf8')
    .replace('config=/etc/nginx/nginx.conf', 'config="$TEST_DIR/nginx.conf"')
    .replace('$EUID == 0 && ', '').replace('/run/lock/klan-nginx-capacity.lock', '"$TEST_DIR/lock"');
  write(script, code);
  const run = (fail = '') => spawnSync(bash, ['-c', `
    flock() { :; }
    nginx() { test -s "$3"; }
    systemctl() {
      if [[ "$1" == reload ]]; then
        echo reload >> "$TEST_DIR/reloads"
        if [[ "$FAIL_RELOAD" == yes ]] && grep -q 'worker_connections 4096' "$TEST_DIR/nginx.conf"; then return 1; fi
      fi
    }
    source "$1"
  `, 'test', shellPath(script)], { encoding: 'utf8', env: { ...bashEnvironment, TEST_DIR: shellPath(root), FAIL_RELOAD: fail } });
  write(config, original);
  assert.notEqual(run('yes').status, 0);
  assert.equal(readFileSync(config, 'utf8'), original);
  const good = run();
  assert.equal(good.status, 0, good.stderr);
  const tuned = original.replace('768;', '4096;') + 'worker_rlimit_nofile 8192;\n';
  assert.equal(readFileSync(config, 'utf8'), tuned);
  assert.equal(run().status, 0);
  assert.equal(readFileSync(join(root, 'reloads'), 'utf8').trim().split('\n').length, 3);
  write(config, tuned.replace('4096', '12000').replace('8192', '20000'));
  assert.equal(run().status, 0);
  assert.ok(readFileSync(config, 'utf8').includes('worker_connections 12000;'));
});
// HTTP is always fake. Linux uses real rsync when installed; Windows uses this mirror.
const helper = [
  "import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync, cpSync, chmodSync } from 'node:fs';",
  "import { join, resolve, relative } from 'node:path';",
  "const args=process.argv.slice(3), command=process.argv[2], web=process.env.TEST_WEB;",
  "const root=resolve(process.env.TEST_ROOT);",
  "function confined(path) { const value=resolve(path); if (relative(root,value).startsWith('..')) throw Error('Outside test fixture'); return value; }",
  "function files(dir,prefix='') { if(!existsSync(dir)) return []; return readdirSync(dir,{withFileTypes:true}).filter(e=>e.name!=='.well-known').flatMap(e=>e.isDirectory()?files(join(dir,e.name),prefix+e.name+'/'):[[prefix+e.name,readFileSync(join(dir,e.name)).toString('base64')]]).sort(); }",
  "if(command==='curl') {",
  " const output=args[args.indexOf('--output')+1], url=new URL(args.at(-1)), isNew=url.search.includes(process.env.TEST_NEW_ID);",
  " let path=url.pathname; const key=path==='/deploy-version.txt'?'version':path==='/deploy-site.txt'?'site':path==='/users/1'?'deep':'root';",
  " if(isNew && process.env.FAIL_HTTP===key) { writeFileSync(output,'wrong frontend response'); process.exit(0); }",
  " if(path==='/' || path==='/users/1') path='/index.html';",
  " try { writeFileSync(output,readFileSync(join(web,path.slice(1)))); } catch { process.exit(22); }",
  "} else if(command==='rsync') {",
  " const source=confined(args.at(-2)), target=confined(args.at(-1));",
  " if(args.includes('--dry-run')) { if(JSON.stringify(files(source))!==JSON.stringify(files(target))) process.stdout.write('changed\\n'); process.exit(0); }",
  " mkdirSync(target,{recursive:true});",
  " if(process.env.FAIL_PUBLISH==='yes' && source.includes(process.env.TEST_NEW_ID)) { writeFileSync(join(target,'index.html'),'partial upload'); process.exit(23); }",
  " if(args.includes('--delete-after')) for(const name of readdirSync(target)) if(name!=='.well-known') rmSync(join(target,name),{recursive:true,force:true});",
  " for(const name of readdirSync(source)) if(name!=='.well-known') cpSync(join(source,name),join(target,name),{recursive:true});",
  " if(args.some(a=>a.startsWith('--chmod='))) {",
  "  const modes=dir=>{ chmodSync(dir,0o755); for(const e of readdirSync(dir,{withFileTypes:true})) { if(e.name==='.well-known') continue; const p=join(dir,e.name); if(e.isDirectory()) modes(p); else chmodSync(p,0o644); } }; modes(target);",
  " }",
  "} else throw Error('Unknown fake command');",
].join('\n');

function harness(context, { previous = true } = {}) {
  const temporary = mkdtempSync(join(tmpdir(), 'klan-static-deploy-'));
  context.after(() => {
    assert.ok(resolve(temporary).startsWith(resolve(tmpdir()) + sep));
    rmSync(temporary, { recursive: true, force: true });
  });
  const root = join(temporary, 'opt', 'klan', 'frontend'), web = join(temporary, 'var', 'www', 'klan');
  const bin = join(temporary, 'bin'), incoming = join(root, 'incoming', newId);
  mkdirSync(join(root, 'releases'), { recursive: true });
  mkdirSync(web, { recursive: true });
  const server = readFileSync(join(deployDirectory, 'server-release.sh'), 'utf8')
    .replaceAll('/opt/klan/frontend', shellPath(root)).replaceAll('/var/www/klan', shellPath(web));
  write(join(incoming, 'Deploy', 'server-release.sh'), server);
  write(join(incoming, 'commit'), newSha + '\n');
  write(join(incoming, 'production-url'), 'https://klan.example.test\n');
  const helperPath = join(temporary, 'helper.mjs');
  write(helperPath, helper);
  for (const command of ['curl', 'rsync']) {
    let body = '#!/usr/bin/env bash\n';
    if (command === 'rsync') body += 'if [[ -n "$REAL_RSYNC" && "$FAIL_PUBLISH" != yes ]]; then exec "$REAL_RSYNC" "$@"; fi\n';
    body += 'exec "$TEST_NODE" "$TEST_HELPER" ' + command + ' "$@"\n';
    write(join(bin, command), body);
  }
  write(join(bin, 'flock'), '#!/usr/bin/env bash\nexit 0\n');
  write(join(bin, 'ssh'), '#!/usr/bin/env bash\nprintf unexpected-ssh >&2\nexit 99\n');
  const chmod = spawnSync(bash, ['-c', 'chmod +x "$1"/*', 'test', shellPath(bin)], { env: bashEnvironment, encoding: 'utf8' });
  assert.equal(chmod.status, 0, chmod.stderr);
  const environment = {
    ...bashEnvironment, TEST_BIN: shellPath(bin), TEST_NODE: shellPath(process.execPath),
    TEST_HELPER: shellPath(helperPath), TEST_WEB: web, TEST_ROOT: temporary,
    TEST_NEW_ID: newId, REAL_RSYNC: realRsync, FAIL_HTTP: '', FAIL_PUBLISH: '',
  };
  function shell(code, args = []) {
    const result = spawnSync(bash, ['-c', code, 'test', ...args], { env: environment, encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return result.stdout.trim();
  }
  function command(path, args = [], extra = {}) {
    return spawnSync(bash, ['-c', 'export PATH="$TEST_BIN:$PATH"; exec bash "$@"', 'test', shellPath(path), ...args], {
      env: { ...environment, ...extra }, encoding: 'utf8', timeout: 30_000,
    });
  }
  function publicFiles(directory, sha, label) {
    write(join(directory, 'index.html'), '<html><div id="app">' + label + '</div></html>\n');
    write(join(directory, 'deploy-version.txt'), sha + '\n');
    write(join(directory, 'deploy-site.txt'), 'klan-frontend\n');
    write(join(directory, 'assets', label + '.js'), 'static ' + label + '\n');
    for (const file of ['index.html', 'deploy-version.txt', 'deploy-site.txt']) utimesSync(join(directory, file), 1_700_000_000, 1_700_000_000);
  }
  const source = join(temporary, 'dist');
  publicFiles(source, newSha, 'new');
  function checksum() {
    write(join(incoming, 'frontend.tar.gz.sha256'), createHash('sha256').update(readFileSync(join(incoming, 'frontend.tar.gz'))).digest('hex') + '\n');
  }
  function archive(options = []) {
    shell('tar -C "$1" -czf "$2" "${@:3}" .', [shellPath(source), shellPath(join(incoming, 'frontend.tar.gz')), ...options]);
    checksum();
  }
  archive();
  const old = join(root, 'releases', oldId);
  if (previous) {
    publicFiles(join(old, 'public'), oldSha, 'old');
    write(join(old, 'Deploy', 'server-release.sh'), server);
    write(join(old, 'kind'), 'static\n');
    write(join(old, 'commit'), oldSha + '\n');
    write(join(old, 'production-url'), 'https://klan.example.test\n');
    publicFiles(web, oldSha, 'old');
    shell('ln -s "$1" "$2"', ['releases/' + oldId, shellPath(join(root, 'static-current'))]);
  } else write(join(web, 'index.html'), 'Original website\n');
  write(join(web, '.well-known', 'keep.txt'), 'ACME content\n');
  return {
    temporary, root, web, source, incoming, old, shell, command, checksum, archive,
    deploy: (extra = {}) => command(join(incoming, 'Deploy', 'server-release.sh'), ['deploy'], extra),
    rollback: (extra = {}) => command(join(root, 'releases', newId, 'Deploy', 'server-release.sh'), ['rollback'], extra),
    current: () => shell('if test -L "$1"; then readlink "$1"; fi', [shellPath(join(root, 'static-current'))]),
    previous: () => shell('if test -L "$1"; then readlink "$1"; fi', [shellPath(join(root, 'static-previous'))]),
    version: () => readFileSync(join(web, 'deploy-version.txt'), 'utf8').trim(),
  };
}

test('verified archive copies same-size/mtime files, preserves ACME and rolls back', { skip: unavailable }, (context) => {
  const f = harness(context), result = f.deploy();
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(f.version(), newSha);
  assert.equal(f.current(), 'releases/' + newId);
  assert.equal(f.previous(), 'releases/' + oldId);
  assert.ok(existsSync(join(f.web, 'assets/new.js')));
  assert.equal(existsSync(join(f.web, 'assets/old.js')), false);
  assert.equal(readFileSync(join(f.web, '.well-known/keep.txt'), 'utf8'), 'ACME content\n');
  assert.equal(existsSync(join(f.web, 'Deploy')), false);
  assert.equal(existsSync(join(f.web, 'production-url')), false);
  if (process.platform !== 'win32') {
    assert.equal(statSync(f.web).mode & 0o777, 0o755);
    assert.equal(statSync(join(f.web, 'assets')).mode & 0o777, 0o755);
    assert.equal(statSync(join(f.web, 'index.html')).mode & 0o777, 0o644);
  }
  const rollback = f.rollback();
  assert.equal(rollback.status, 0, rollback.stderr);
  assert.equal(f.version(), oldSha);
  assert.equal(f.current(), 'releases/' + oldId);
  assert.equal(f.previous(), 'releases/' + newId);
  assert.ok(existsSync(join(f.web, 'assets/old.js')));
  assert.equal(existsSync(join(f.web, 'assets/new.js')), false);
});
for (const failure of ['version', 'site', 'root', 'deep']) {
  test('wrong HTTP ' + failure + ' restores files and state', { skip: unavailable }, (context) => {
    const f = harness(context), result = f.deploy({ FAIL_HTTP: failure });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Previous frontend restored/);
    assert.equal(f.version(), oldSha);
    assert.equal(f.current(), 'releases/' + oldId);
    assert.equal(f.previous(), '');
  });
}
test('partial first publication restores the original site and preserves ACME', { skip: unavailable }, (context) => {
  const f = harness(context, { previous: false }), result = f.deploy({ FAIL_PUBLISH: 'yes' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Previous frontend restored/);
  assert.equal(readFileSync(join(f.web, 'index.html'), 'utf8'), 'Original website\n');
  assert.equal(existsSync(join(f.web, 'deploy-version.txt')), false);
  assert.equal(f.current(), '');
  assert.ok(existsSync(join(f.web, '.well-known/keep.txt')));
});
test('historic Docker links and runtime.env stay outside the web root', { skip: unavailable }, (context) => {
  const f = harness(context, { previous: false });
  const legacy = join(f.root, 'releases', 'c'.repeat(40) + '-0-1');
  write(join(legacy, 'runtime.env'), 'SYNTHETIC_PRIVATE_VALUE=keep-private\n');
  f.shell('ln -s "$1" "$2"', ['releases/' + 'c'.repeat(40) + '-0-1', shellPath(join(f.root, 'current'))]);
  const result = f.deploy();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(f.web, 'runtime.env')), false);
  assert.equal(readFileSync(join(legacy, 'runtime.env'), 'utf8'), 'SYNTHETIC_PRIVATE_VALUE=keep-private\n');
  assert.match(f.previous(), /^releases\/bootstrap-/);
  const rollback = f.rollback();
  assert.equal(rollback.status, 0, rollback.stderr);
  assert.equal(readFileSync(join(f.web, 'index.html'), 'utf8'), 'Original website\n');
});
test('failed publication restores an initially empty static root', { skip: unavailable }, (context) => {
  const f = harness(context, { previous: false });
  rmSync(join(f.web, 'index.html'));
  const result = f.deploy({ FAIL_PUBLISH: 'yes' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Previous frontend restored/);
  assert.equal(existsSync(join(f.web, 'index.html')), false);
  assert.equal(f.current(), '');
  assert.ok(existsSync(join(f.web, '.well-known/keep.txt')));
});
test('a foreign current link is rejected before publication', { skip: unavailable }, (context) => {
  const f = harness(context);
  f.shell('rm -- "$1"; ln -s "$2" "$1"', [shellPath(join(f.root, 'static-current')), shellPath(f.source)]);
  const result = f.deploy();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid static-current/);
  assert.equal(f.version(), oldSha);
});
test('rollback without a previous static release keeps the current site intact', { skip: unavailable }, (context) => {
  const f = harness(context);
  const result = f.command(join(f.old, 'Deploy/server-release.sh'), ['rollback']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No previous static release/);
  assert.equal(f.version(), oldSha);
});
test('checksum mismatch is rejected before publishing', { skip: unavailable }, (context) => {
  const f = harness(context);
  write(join(f.incoming, 'frontend.tar.gz.sha256'), '0'.repeat(64) + '\n');
  const result = f.deploy();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /checksum mismatch/);
  assert.equal(f.version(), oldSha);
});
test('path traversal is rejected before extraction', { skip: unavailable }, (context) => {
  const f = harness(context);
  f.archive(['--transform=s,index.html,../escape.html,']);
  const result = f.deploy();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsafe path/);
  assert.equal(f.version(), oldSha);
  assert.equal(existsSync(join(f.root, 'releases/escape.html')), false);
});
test('symlinks are rejected before extraction', { skip: unavailable }, (context) => {
  const f = harness(context);
  f.shell('ln -s index.html "$1"', [shellPath(join(f.source, 'linked.html'))]);
  f.archive();
  const result = f.deploy();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /link or special file/);
  assert.equal(f.version(), oldSha);
});
test('archive version must match the requested commit', { skip: unavailable }, (context) => {
  const f = harness(context);
  write(join(f.source, 'deploy-version.txt'), oldSha + '\n');
  f.archive();
  const result = f.deploy();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expected frontend build/);
  assert.equal(f.version(), oldSha);
});
test('packaging creates checksum and refuses hidden configuration', { skip: unavailable }, (context) => {
  const f = harness(context), artifact = join(f.temporary, 'artifact');
  let result = f.command(join(deployDirectory, 'package.sh'), [shellPath(f.source), shellPath(artifact)], { GITHUB_SHA: newSha });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(artifact, 'frontend.tar.gz.sha256'), 'utf8').trim(), createHash('sha256').update(readFileSync(join(artifact, 'frontend.tar.gz'))).digest('hex'));
  write(join(f.source, '.env'), 'SYNTHETIC_SECRET=not-for-browser\n');
  result = f.command(join(deployDirectory, 'package.sh'), [shellPath(f.source), shellPath(artifact)], { GITHUB_SHA: newSha });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /hidden file/);
});
const transportEnvironment = {
  DEPLOY_HOST: 'server.example.test', DEPLOY_PORT: '22', DEPLOY_USER: 'deploy',
  DEPLOY_SSH_KEY: 'synthetic-key', DEPLOY_KNOWN_HOSTS: 'synthetic-host-key',
  PRODUCTION_URL: 'https://klan.example.test', GITHUB_SHA: newSha, GITHUB_RUN_ID: '2', GITHUB_RUN_ATTEMPT: '1',
};
for (const [setting, value, message] of [
  ['DEPLOY_HOST', "host';command", 'Invalid SSH host'],
  ['DEPLOY_USER', 'user;command', 'Invalid SSH user'],
  ['DEPLOY_PORT', '0', 'Invalid SSH port'],
  ['PRODUCTION_URL', 'http://klan.example.test', 'HTTPS origin'],
  ['PRODUCTION_URL', 'https://klan.example.test/path', 'HTTPS origin'],
  ['PRODUCTION_URL', 'https://user@klan.example.test', 'HTTPS origin'],
  ['PRODUCTION_URL', 'https://klan.example.test:70000', 'Invalid production URL port'],
  ['GITHUB_SHA', 'main', 'Invalid commit'],
]) {
  test('transport rejects ' + setting + '=' + value + ' before SSH', { skip: unavailable }, (context) => {
    const f = harness(context);
    const result = f.command(join(deployDirectory, 'deploy.sh'), [shellPath(f.incoming)], { ...transportEnvironment, [setting]: value });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(message));
    assert.doesNotMatch(result.stderr, /unexpected-ssh/);
  });
}
