/**
 * dsh-boot-anim · 窗口控件透明补丁（辅助进程）
 *
 * 作用：把 DSH 主进程里 titleBarOverlay 的底色改成透明，让开屏画面完全铺满
 *       （右上角只剩三个窗口按钮图标浮在画面上）。
 *
 * 做法：等长替换 —— 原 55 字符换成 55 字符，文件大小与 asar 内所有 offset 全不变，
 *       因此不需要重打包，也不破坏 asar 结构。
 *
 *   原： nativeTheme.shouldUseDarkColors ? "#1b1b1c" : "#f9fafb"
 *   新： nativeTheme.shouldUseDarkColors?"#00000000":"#00000000"
 *
 * 用法：
 *   node asar-patch.mjs <app.asar 路径> [--now] [--revert] [--no-restart] [--log=路径]
 *   --now         跳过"等待 DSH 退出"（仅测试用）
 *   --revert      从备份还原
 *   --no-restart  完成后不重启 DSH
 */
import { closeSync, copyFileSync, existsSync, openSync, readFileSync, readSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';

const require2 = createRequire(import.meta.url);

const argv = process.argv.slice(2);
const asarPath = argv.find((a) => !a.startsWith('--'));
const FLAG = (name) => argv.includes('--' + name);
const now = FLAG('now');
const revert = FLAG('revert');
const noRestart = FLAG('no-restart');
const logArg = argv.find((a) => a.startsWith('--log='));
const logPath = logArg ? logArg.slice(6) : join(dirname(asarPath || '.'), 'dsh-boot-anim-patch.log');

const FROM = 'nativeTheme.shouldUseDarkColors ? "#1b1b1c" : "#f9fafb"';
const TO = 'nativeTheme.shouldUseDarkColors?"#00000000":"#00000000"';
const MARK = 'shouldUseDarkColors?"#00000000"';

function log(line) {
  const text = '[' + new Date().toLocaleString('zh-CN') + '] ' + line;
  try { writeFileSync(logPath, text + '\n', { flag: 'a' }) } catch (e) {}
  console.log(text);
}

/** DSH 主进程是否还在运行（用命令行特征识别，不会误判本脚本自己） */
function dshRunning() {
  try {
    const ps = 'Get-CimInstance Win32_Process -Filter "Name=\'DeepSeek Harness.exe\'" | Where-Object { $_.CommandLine -like \'*dsh-desktop-host*\' } | Measure-Object | Select-Object -ExpandProperty Count';
    const out = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', timeout: 20000 });
    return Number((out.stdout || '0').trim()) > 0;
  } catch (e) { return false }
}

function exePathFor(asar) {
  /* <安装目录>\resources\app.asar → <安装目录>\DeepSeek Harness.exe */
  const resources = dirname(asar);
  const root = dirname(resources);
  for (const name of readdirSafe(root)) {
    if (/^DeepSeek Harness\.exe$/i.test(name)) return join(root, name);
  }
  return null;
}
function readdirSafe(dir) {
  try { return readdirSync(dir) } catch (e) { return [] }
}

function findOffset(file) {
  const size = statSync(file).size;
  const fd = openSync(file, 'r');
  const CHUNK = 8 * 1024 * 1024;
  const buf = Buffer.alloc(CHUNK);
  const needle = Buffer.from(FROM, 'latin1');
  const mark = Buffer.from(MARK, 'latin1');
  let pos = 0;
  let carry = Buffer.alloc(0);
  const hits = [];
  while (pos < size) {
    const read = readSync(fd, buf, 0, CHUNK, pos);
    if (read <= 0) break;
    const window = Buffer.concat([carry, buf.subarray(0, read)]);
    const base = pos - carry.length;
    let at = window.indexOf(needle);
    while (at >= 0) { hits.push({ kind: 'from', offset: base + at }); at = window.indexOf(needle, at + 1) }
    let at2 = window.indexOf(mark);
    while (at2 >= 0) { hits.push({ kind: 'patched', offset: base + at2 }); at2 = window.indexOf(mark, at2 + 1) }
    carry = window.subarray(Math.max(0, window.length - needle.length));
    pos += read;
  }
  closeSync(fd);
  return { hits, size };
}

function verifyAsar(asar) {
  const fd = openSync(asar, 'r');
  const head = Buffer.alloc(16);
  readSync(fd, head, 0, 16, 0);
  const headerSize = head.readUInt32LE(12);
  if (headerSize <= 0 || headerSize > 64 * 1024 * 1024) { closeSync(fd); throw new Error('asar header 尺寸异常：' + headerSize) }
  const json = Buffer.alloc(headerSize);
  readSync(fd, json, 0, headerSize, 16);
  closeSync(fd);
  const parsed = JSON.parse(json.toString('utf8'));
  if (!parsed.files) throw new Error('asar header 解析后没有 files 字段');
  return Object.keys(parsed.files).length;
}

async function waitForExit(maxMs) {
  if (now) return true;
  const started = Date.now();
  log('等待 DSH 退出（最多 ' + Math.round(maxMs / 60000) + ' 分钟）…');
  while (Date.now() - started < maxMs) {
    if (!dshRunning()) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

function restart(exe) {
  if (noRestart || !exe) return;
  try {
    const child = spawn(exe, [], { detached: true, stdio: 'ignore' });
    child.unref();
    log('已重新启动 DSH：' + exe);
  } catch (e) { log('重启失败（请手动打开 DSH）：' + e.message) }
}

async function main() {
  if (!asarPath || !existsSync(asarPath)) { log('找不到 app.asar：' + asarPath); process.exit(2) }
  const exe = exePathFor(asarPath);
  const backup = asarPath + '.bak';
  log('目标：' + asarPath + '（' + (statSync(asarPath).size / 1048576).toFixed(1) + ' MB）');

  if (!(await waitForExit(5 * 60 * 1000))) { log('等不到 DSH 退出，已放弃（未做任何修改）'); process.exit(3) }

  if (revert) {
    if (!existsSync(backup)) { log('没有备份文件，无法还原：' + backup); process.exit(4) }
    copyFileSync(backup, asarPath);
    log('已从备份还原：' + backup);
    restart(exe);
    process.exit(0);
  }

  const found = findOffset(asarPath);
  const already = found.hits.filter((h) => h.kind === 'patched');
  const targets = found.hits.filter((h) => h.kind === 'from');
  if (already.length > 0 && targets.length === 0) { log('补丁已是应用状态，无需操作'); restart(exe); process.exit(0) }
  if (targets.length !== 1) { log('锚点异常：找到 ' + targets.length + ' 处目标字符串（应为 1），为保证安全不做修改'); process.exit(5) }
  if (FROM.length !== TO.length) { log('内部错误：替换前后长度不一致'); process.exit(6) }

  if (!existsSync(backup)) {
    copyFileSync(asarPath, backup);
    log('已备份 → ' + backup);
  } else {
    log('备份已存在，保留最初的那一份：' + backup);
  }

  const at = targets[0].offset;
  const fd = openSync(asarPath, 'r+');
  try {
    const before = Buffer.alloc(FROM.length);
    readSync(fd, before, 0, FROM.length, at);
    if (before.toString('latin1') !== FROM) throw new Error('写入前校验失败（内容与预期不符）');
    writeSync(fd, Buffer.from(TO, 'latin1'), 0, TO.length, at);
    const after = Buffer.alloc(TO.length);
    readSync(fd, after, 0, TO.length, at);
    if (after.toString('latin1') !== TO) throw new Error('写入后校验失败');
  } catch (error) {
    closeSync(fd);
    log('打补丁失败：' + error.message + ' → 正在从备份还原');
    try { copyFileSync(backup, asarPath); log('已还原，DSH 可正常启动') } catch (e) { log('还原也失败，请手动把 ' + backup + ' 复制为 ' + asarPath) }
    process.exit(7);
  }
  closeSync(fd);

  const beforeSize = found.size;
  const afterSize = statSync(asarPath).size;
  if (beforeSize !== afterSize) { log('文件大小发生变化（' + beforeSize + ' → ' + afterSize + '），正在还原'); copyFileSync(backup, asarPath); process.exit(8) }

  try {
    const count = verifyAsar(asarPath);
    log('校验通过：asar 结构完好（顶层条目 ' + count + ' 个），文件大小未变，补丁位置 ' + at);
  } catch (error) {
    log('asar 校验失败：' + error.message + ' → 正在还原');
    copyFileSync(backup, asarPath);
    process.exit(9);
  }

  log('补丁已应用 ✓  右上角按钮区底色将变为透明（重启后生效）');
  restart(exe);
  process.exit(0);
}

main().catch((error) => { log('异常：' + (error && error.stack || error)); process.exit(1) });
