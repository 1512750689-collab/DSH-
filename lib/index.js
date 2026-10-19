import { closeSync, copyFileSync, createReadStream, createWriteStream, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require2 = createRequire(import.meta.url);

export const name = 'dsh-boot-anim';
export const inject = ['webServer'];

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MEDIA_DIR = join(ROOT, 'media');
const SFX_DIR = join(ROOT, 'sfx');
const ROUTE = '/dsh-boot-anim';
const read = (file) => readFileSync(join(ROOT, 'lib', file), 'utf8');

const DEFAULTS = {
  enabled: true, style: 'custom', media: 'auto', fit: 'cover', mediaPosition: 'center', veil: 'auto', loop: true, minDurationMs: 3000,
  mediaStartMs: 0, mediaDurationMs: 0, mediaMuted: true, titleDelayMs: 6000, titleColor: '',
  sfx: 'auto', sfxVolume: 0.7, sfxStartMs: 0, sfxDurationMs: 0, sfxFadeOutMs: 600,
  title: '', subtitle: '', titleFont: '华文新魏', titleFontSize: 0, subtitleFontSize: 0,
  waitForInput: false, hint: '', autoEnterMs: 12000, skippable: true, waitForMediaEnd: true,
  flashEnabled: true, flashColor: '#dff8ff', flashIntensity: 78, flashDurationMs: 900,
  flashAt: 'both', flashPulse: true, flashPulseIntensity: 16, flashPulseSpeed: 4.5, flashRing: true,
};

const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.avi', '.wmv', '.flv', '.mpg', '.mpeg', '.ts', '.m2ts', '.3gp', '.ogv']);
const IMAGE_EXT = new Set(['.gif', '.apng', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg']);
const MEDIA_EXT = [...VIDEO_EXT, ...IMAGE_EXT];
const SFX_EXT = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.mp4', '.m4v', '.mov', '.webm'];

const MIME = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v',
  '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.wmv': 'video/x-ms-wmv', '.flv': 'video/x-flv',
  '.mpg': 'video/mpeg', '.mpeg': 'video/mpeg', '.ts': 'video/mp2t', '.m2ts': 'video/mp2t', '.3gp': 'video/3gpp', '.ogv': 'video/ogg',
  '.gif': 'image/gif', '.apng': 'image/apng', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.aac': 'audio/aac', '.flac': 'audio/flac', '.opus': 'audio/ogg',
};

/** 面板可选的书法字体（本机自带）。 */
/* 字体名一律用 Windows 注册表里的名字（中文名最可靠），引擎会照名字直接匹配 */
const FONTS = [
  { id: '华文新魏', label: '华文新魏 · 硬朗金石（默认）' },
  { id: '华文行楷', label: '华文行楷 · 飘逸行书' },
  { id: '华文隶书', label: '华文隶书 · 古朴隶体' },
  { id: '隶书', label: '隶书 · 方正隶体' },
  { id: '方正舒体', label: '方正舒体 · 舒展随性' },
  { id: '华文楷体', label: '华文楷体 · 端正' },
  { id: '楷体', label: '楷体 · 系统楷体' },
  { id: '华文中宋', label: '华文中宋 · 典雅' },
  { id: '华文仿宋', label: '华文仿宋 · 书卷气' },
  { id: '华文琥珀', label: '华文琥珀 · 厚重广告体' },
  { id: '华文彩云', label: '华文彩云 · 装饰空心体' },
  { id: '微软雅黑', label: '微软雅黑 · 现代无衬线' },
  { id: '宋体', label: '宋体 · 经典' },
];

// ---------------------------------------------------------------- 配置读写

/** JSONC → JSON：按字符扫描，正确跳过字符串内的 //，支持块注释与尾随逗号。 */
function stripJsonc(text) {
  const src = text.replace(/\r\n?/g, '\n');
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === '/' && next === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue; }
    if (ch === '/' && next === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i++; continue; }
    out += ch;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function readConfig() {
  const file = join(ROOT, 'config.jsonc');
  if (!existsSync(file)) return {};
  try { return JSON.parse(stripJsonc(readFileSync(file, 'utf8'))) }
  catch (error) { console.error('[dsh-boot-anim] config.jsonc 解析失败，改用默认配置：' + error.message); return {} }
}

/** 把配置写回 config.jsonc（保留注释模板，方便继续手改）。 */
function writeConfig(config) {
  const str = (v) => JSON.stringify(v);
  const num = (v, d) => Number.isFinite(Number(v)) ? Number(v) : d;
  const text = [
    '{',
    '  // ============ dsh-boot-anim 配置（设置页「开屏动画」可改，也可手动编辑）============',
    '',
    '  "enabled": ' + str(config.enabled !== false) + ',',
    '  "style": "custom",',
    '',
    '  // ---- 动画素材 ----',
    '  "media": ' + str(config.media || 'auto') + ',',
    '  "fit": ' + str(config.fit || 'cover') + ',   // cover 铺满裁切 | contain 完整留边 | blur 模糊填充（不裁也不留边）',
    '  "mediaPosition": ' + str(config.mediaPosition || 'center') + ',   // cover 裁切时的焦点：top | center | bottom',
    '  "veil": ' + str(config.veil === undefined ? 'auto' : config.veil) + ',',
    '  "loop": ' + str(config.loop !== false) + ',',
    '  "mediaStartMs": ' + str(Number(config.mediaStartMs) || 0) + ',',
    '  "mediaDurationMs": ' + str(Number(config.mediaDurationMs) || 0) + ',',
    '  "mediaMuted": ' + str(config.mediaMuted !== false) + ',',
    '  "titleDelayMs": ' + str(Number(config.titleDelayMs) || 0) + ',',
    '',
    '  // ---- 开屏时长与交互 ----',
    '  "minDurationMs": ' + str(Number(config.minDurationMs) || 3000) + ',',
    '  "skippable": ' + str(config.skippable !== false) + ',',
    '  "waitForInput": ' + str(config.waitForInput === true) + ',',
    '  "hint": ' + str(config.hint || '') + ',',
    '  "autoEnterMs": ' + str(Number(config.autoEnterMs) || 12000) + ',',
    '',
    '  // ---- 第三层 · 闪烁（v2.0）----',
    '  "flashEnabled": ' + str(config.flashEnabled !== false) + ',',
    '  "flashColor": ' + str(config.flashColor || '#dff8ff') + ',',
    '  "flashIntensity": ' + str(Math.max(0, Math.min(100, num(config.flashIntensity, 78)))) + ',',
    '  "flashDurationMs": ' + str(Math.max(200, Math.min(3000, num(config.flashDurationMs, 900)))) + ',',
    '  "flashAt": ' + str(['start','end','both','off'].includes(config.flashAt) ? config.flashAt : 'both') + ',',
    '  "flashPulse": ' + str(config.flashPulse !== false) + ',',
    '  "flashPulseIntensity": ' + str(Math.max(0, Math.min(100, num(config.flashPulseIntensity, 16)))) + ',',
    '  "flashPulseSpeed": ' + str(Math.max(1.5, Math.min(10, num(config.flashPulseSpeed, 4.5)))) + ',',
    '  "flashRing": ' + str(config.flashRing !== false) + ',',
    '',
    '  // 素材模式下等视频播完再进入（关掉则只按 minDurationMs 计时）',
    '  "waitForMediaEnd": ' + str(config.waitForMediaEnd !== false) + ',',
    '  // 注：窗口右上角的按钮区由 DSH 主进程绘制在网页之上，插件无法覆盖（详见 README）',
    '',
    '  // ---- 落款文字 ----',
    '  "title": ' + str(config.title || '') + ',',
    '  "subtitle": ' + str(config.subtitle || '') + ',',
    '  "titleFont": ' + str(config.titleFont || '华文新魏') + ',',
    '  // 字号（px）；0 = 自动（跟随内置样式）',
    '  "titleFontSize": ' + str(Number(config.titleFontSize) || 0) + ',',
    '  "subtitleFontSize": ' + str(Number(config.subtitleFontSize) || 0) + ',',
    '  "titleColor": ' + str(config.titleColor || '') + ',',
    '',
    '  // ---- 音乐 ----',
    '  "sfx": ' + str(config.sfx || 'auto') + ',',
    '  "sfxVolume": ' + str(typeof config.sfxVolume === 'number' ? config.sfxVolume : 0.7) + ',',
    '  "sfxStartMs": ' + str(Number(config.sfxStartMs) || 0) + ',',
    '  "sfxDurationMs": ' + str(Number(config.sfxDurationMs) || 0) + ',',
    '  "sfxFadeOutMs": ' + str(Number(config.sfxFadeOutMs) || 600) + '',
    '}',
    '',
  ].join('\n');
  writeFileSync(join(ROOT, 'config.jsonc'), text, 'utf8');
  return config;
}

// ---------------------------------------------------------------- 素材解析

function pickFile(dir, exts) {
  if (!existsSync(dir)) return null;
  const names = readdirSync(dir).filter((f) => exts.includes(extname(f).toLowerCase()))
    .filter((f) => { try { return statSync(join(dir, f)).isFile() } catch (e) { return false } }).sort();
  return names.length > 0 ? join(dir, names[0]) : null;
}

/** spec：'auto'（目录第一个）| 'none' | 相对插件目录 | 绝对路径。
 *  指定了具体文件但找不到时返回 null —— 回退内置开屏动画，不偷偷播别的文件。 */
function resolveMedia(spec, dir, exts) {
  if (spec === 'none' || spec === false || spec === undefined) return null;
  if (typeof spec === 'string' && spec !== 'auto' && spec.trim() !== '') {
    const candidates = /^[a-zA-Z]:[\\/]|^\//.test(spec) ? [spec] : [join(dir, spec), join(ROOT, spec)];
    for (const file of candidates) {
      try { if (existsSync(file) && statSync(file).isFile()) return file } catch (e) {}
    }
    console.error('[dsh-boot-anim] 素材不存在：' + spec + '（回退内置开屏动画）');
    return null;
  }
  return pickFile(dir, exts);
}

/** 读出视频主编码（只读头尾各 2MB）。 */
function videoCodec(file) {
  try {
    const { openSync, readSync, closeSync, fstatSync } = require2('node:fs');
    const fd = openSync(file, 'r');
    const size = fstatSync(fd).size;
    const chunk = 2 * 1024 * 1024;
    const head = Buffer.alloc(Math.min(size, chunk));
    readSync(fd, head, 0, head.length, 0);
    const tail = Buffer.alloc(Math.min(size, chunk));
    readSync(fd, tail, 0, tail.length, Math.max(0, size - chunk));
    closeSync(fd);
    const has = (tag) => head.includes(Buffer.from(tag, 'latin1')) || tail.includes(Buffer.from(tag, 'latin1'));
    if (has('hvc1') || has('hev1')) return 'hevc';
    if (has('avc1') || has('avc3')) return 'avc';
    if (has('av01')) return 'av1';
    if (has('vp09')) return 'vp9';
    return 'unknown';
  } catch (e) { return 'unknown' }
}

/** Chromium 能不能直接播？不能就先转码。 */
function needsTranscode(file, ext) {
  const e = String(ext).toLowerCase();
  if (IMAGE_EXT.has(e)) return false;
  if (e === '.webm' || e === '.ogv') return false;
  if (e === '.mp4' || e === '.m4v' || e === '.mov') {
    const codec = videoCodec(file);
    return codec !== 'avc' && codec !== 'av1' && codec !== 'vp9';
  }
  return true;
}

/** 用 tools\ffmpeg.exe 转成 H.264 mp4。 */
function transcodeHevc(src, destDir, base) {
  const ff = join(ROOT, 'tools', 'ffmpeg.exe');
  if (!existsSync(ff)) return { ok: false, error: '缺少 tools\\ffmpeg.exe，无法自动转码' };
  const out = join(destDir, base + '-h264.mp4');
  const res = spawnSync(ff, ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out], { timeout: 900000 });
  if (res.status !== 0 || !existsSync(out)) return { ok: false, error: 'ffmpeg 转码失败：' + String(res.stderr || '').slice(0, 300) };
  return { ok: true, name: base + '-h264.mp4' };
}

// ---------------------------------------------------------------- HTTP 小工具

function listDir(dir, exts) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => exts.includes(extname(n).toLowerCase()))
    .filter((n) => { try { return statSync(join(dir, n)).isFile() } catch (e) { return false } }).sort();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 512) { reject(new Error('body too large')); req.destroy(); return; }
      parts.push(chunk);
    });
    req.on('end', () => { try { resolve(parts.length === 0 ? {} : JSON.parse(Buffer.concat(parts).toString('utf8'))) } catch (e) { reject(e) } });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function serveFile(req, res, file) {
  let stat;
  try { stat = statSync(file) } catch (e) { res.writeHead(404); res.end(); return }
  if (!stat.isFile()) { res.writeHead(404); res.end(); return }
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const base = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'no-store' };
  const range = req.headers.range;
  if (typeof range === 'string' && range.startsWith('bytes=')) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.slice(6).trim());
    if (match !== null) {
      let start = match[1] === '' ? null : Number(match[1]);
      let end = match[2] === '' ? null : Number(match[2]);
      if (start === null && end !== null) { start = Math.max(0, stat.size - end); end = stat.size - 1; }
      else { if (start === null) start = 0; if (end === null || end >= stat.size) end = stat.size - 1; }
      if (start > end || start >= stat.size) { res.writeHead(416, { 'content-range': 'bytes */' + stat.size }); res.end(); return }
      res.writeHead(206, { ...base, 'content-range': 'bytes ' + start + '-' + end + '/' + stat.size, 'content-length': String(end - start + 1) });
      if (req.method === 'HEAD') { res.end(); return }
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
  }
  res.writeHead(200, { ...base, 'content-length': String(stat.size) });
  if (req.method === 'HEAD') { res.end(); return }
  createReadStream(file).pipe(res);
}

// ---------------------------------------------------------------- 窗口控件透明补丁

const WCT_FROM = 'nativeTheme.shouldUseDarkColors ? "#1b1b1c" : "#f9fafb"';
const WCT_TO = 'nativeTheme.shouldUseDarkColors?"#00000000":"#00000000"';
let wctCache = { at: 0, value: null };

/** 定位 DSH 的 app.asar（进程参数 → execPath → 配置）。 */
function findAsar() {
  for (const a of process.argv) {
    const m = /^(.*[\\/]resources)[\\/]app\.asar/.exec(String(a));
    if (m !== null) { const p = join(m[1], 'app.asar'); if (existsSync(p)) return p }
  }
  const exe = process.execPath || '';
  if (/DeepSeek Harness\.exe$/i.test(exe)) {
    const p = join(dirname(exe), 'resources', 'app.asar');
    if (existsSync(p)) return p;
  }
  const cfg = liveConfig || {};
  if (typeof cfg.dshAsarPath === 'string' && existsSync(cfg.dshAsarPath)) return cfg.dshAsarPath;
  return null;
}

/** 流式扫描 asar，判断补丁状态。 */
function wctScan(asar) {
  const fd = openSync(asar, 'r');
  const size = fstatSync(fd).size;
  const CHUNK = 8 * 1024 * 1024;
  const buf = Buffer.alloc(CHUNK);
  const patched = Buffer.from('shouldUseDarkColors?"#00000000"', 'latin1');
  const clean = Buffer.from(WCT_FROM, 'latin1');
  let pos = 0;
  let carry = Buffer.alloc(0);
  let hasPatched = false;
  let hasClean = false;
  while (pos < size && !(hasPatched && hasClean)) {
    const read = readSync(fd, buf, 0, CHUNK, pos);
    if (read <= 0) break;
    const win = Buffer.concat([carry, buf.subarray(0, read)]);
    if (win.includes(patched)) hasPatched = true;
    if (win.includes(clean)) hasClean = true;
    carry = win.subarray(Math.max(0, win.length - Math.max(patched.length, clean.length)));
    pos += read;
  }
  closeSync(fd);
  return { hasPatched, hasClean, size };
}

function wctStatus(force) {
  const now = Date.now();
  if (!force && wctCache.value !== null && now - wctCache.at < 30000) return wctCache.value;
  const asar = findAsar();
  const base = { asar, backup: asar === null ? null : existsSync(asar + '.bak'), log: join(ROOT, 'tools', 'patch.log'), tools: join(ROOT, 'tools') };
  let value;
  if (asar === null) value = { ...base, state: 'not-found', hint: '找不到 app.asar（可手动在 config.jsonc 里写 dshAsarPath）' };
  else {
    try {
      const scan = wctScan(asar);
      const state = scan.hasPatched ? 'patched' : (scan.hasClean ? 'clean' : 'anchor-missing');
      value = { ...base, state, sizeMB: Number((scan.size / 1048576).toFixed(1)) };
    } catch (error) {
      value = { ...base, state: 'error', hint: String((error && error.message) || error) };
    }
  }
  wctCache = { at: now, value };
  return value;
}

/** 用 DSH 自带的运行时以 node 模式跑补丁脚本（等待 DSH 退出 → 打补丁 → 重启）。 */
function runPatchTool(extraArgs) {
  const st = wctStatus(true);
  if (st.asar === null) throw new Error('找不到 app.asar，无法操作');
  const exe = process.execPath;
  const script = join(ROOT, 'tools', 'asar-patch.mjs');
  if (!existsSync(script)) throw new Error('缺少 tools\\asar-patch.mjs');
  const child = spawn(exe, [script, st.asar, '--log=' + join(ROOT, 'tools', 'patch.log')].concat(extraArgs), {
    detached: true, stdio: 'ignore',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  child.unref();
  return { pid: child.pid, asar: st.asar, log: join(ROOT, 'tools', 'patch.log') };
}

// ---------------------------------------------------------------- 插件

let liveConfig = null;

export function apply(ctx) {
  const config = { ...DEFAULTS, ...readConfig() };
  liveConfig = config;
  if (config.enabled === false) return;

  const cur = () => liveConfig || config;
  const resolveNow = () => ({ media: resolveMedia(cur().media, MEDIA_DIR, MEDIA_EXT), sfx: resolveMedia(cur().sfx, SFX_DIR, SFX_EXT) });

  /** 每次渲染 index 时重建：改了配置刷新界面即生效，不必重启应用。 */
  function buildPayload() {
    const cfg = cur();
    const files = resolveNow();
    const mediaExt = files.media === null ? '' : extname(files.media).toLowerCase();
    const veil = cfg.veil === 'auto' ? mediaExt !== '.webm' : cfg.veil !== false;
    return {
      media: files.media === null ? null : ROUTE + '/asset/media',
      mediaKind: VIDEO_EXT.has(mediaExt) ? 'video' : 'image',
      sfx: files.sfx === null ? null : ROUTE + '/asset/sfx',
      style: 'custom',
      fit: cfg.fit === 'contain' ? 'contain' : (cfg.fit === 'blur' ? 'blur' : 'cover'),
      mediaPosition: cfg.mediaPosition === 'top' ? 'top' : (cfg.mediaPosition === 'bottom' ? 'bottom' : 'center'),
      veil, loop: cfg.loop !== false,
      mediaStartMs: Math.max(0, Number(cfg.mediaStartMs) || 0),
      mediaDurationMs: Math.max(0, Number(cfg.mediaDurationMs) || 0),
      mediaMuted: cfg.mediaMuted !== false,
      titleDelayMs: Math.max(0, Number(cfg.titleDelayMs) || 0),
      minDurationMs: Number(cfg.minDurationMs) || DEFAULTS.minDurationMs,
      sfxVolume: typeof cfg.sfxVolume === 'number' ? cfg.sfxVolume : DEFAULTS.sfxVolume,
      sfxStartMs: Math.max(0, Number(cfg.sfxStartMs) || 0),
      sfxDurationMs: Math.max(0, Number(cfg.sfxDurationMs) || 0),
      sfxFadeOutMs: Math.max(0, Number(cfg.sfxFadeOutMs) || 0),
      title: cfg.title ?? '', subtitle: cfg.subtitle ?? '',
      titleFont: cfg.titleFont ?? '', titleColor: cfg.titleColor ?? '',
      titleFontSize: Math.max(0, Number(cfg.titleFontSize) || 0),
      subtitleFontSize: Math.max(0, Number(cfg.subtitleFontSize) || 0),
      waitForInput: cfg.waitForInput === true, hint: cfg.hint ?? '',
      skippable: cfg.skippable !== false,
      waitForMediaEnd: cfg.waitForMediaEnd !== false,
      autoEnterMs: Number(cfg.autoEnterMs) || DEFAULTS.autoEnterMs,
      flashEnabled: cfg.flashEnabled !== false,
      flashColor: /^#[0-9a-f]{6}$/i.test(String(cfg.flashColor || '')) ? cfg.flashColor : '#dff8ff',
      flashIntensity: Math.max(0, Math.min(100, Number.isFinite(Number(cfg.flashIntensity)) ? Number(cfg.flashIntensity) : 78)),
      flashDurationMs: Math.max(200, Math.min(3000, Number.isFinite(Number(cfg.flashDurationMs)) ? Number(cfg.flashDurationMs) : 900)),
      flashAt: ['start', 'end', 'both', 'off'].includes(cfg.flashAt) ? cfg.flashAt : 'both',
      flashPulse: cfg.flashPulse !== false,
      flashPulseIntensity: Math.max(0, Math.min(100, Number.isFinite(Number(cfg.flashPulseIntensity)) ? Number(cfg.flashPulseIntensity) : 16)),
      flashPulseSpeed: Math.max(1.5, Math.min(10, Number.isFinite(Number(cfg.flashPulseSpeed)) ? Number(cfg.flashPulseSpeed) : 4.5)),
      flashRing: cfg.flashRing !== false,
    };
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://x');
      const name2 = url.pathname.slice(ROUTE.length);

      if (name2 === '/api/state' && req.method === 'GET') {
        const files = resolveNow();
        const cfg = cur();
        const tail = (p) => p === null ? null : p.split(/[\\/]/).pop();
        const mediaConfigured = cfg.media !== undefined && cfg.media !== 'auto' && cfg.media !== 'none' && cfg.media !== false && String(cfg.media).trim() !== '';
        const sfxConfigured = cfg.sfx !== undefined && cfg.sfx !== 'auto' && cfg.sfx !== 'none' && cfg.sfx !== false && String(cfg.sfx).trim() !== '';
        sendJson(res, 200, {
          config: cfg,
          configPath: join(ROOT, 'config.jsonc'),
          installPath: ROOT,
          fonts: FONTS,
          files: { media: listDir(MEDIA_DIR, MEDIA_EXT), sfx: listDir(SFX_DIR, SFX_EXT) },
          resolved: { media: tail(files.media), sfx: tail(files.sfx) },
          missing: { media: mediaConfigured && files.media === null, sfx: sfxConfigured && files.sfx === null },
          supported: { video: [...VIDEO_EXT], image: [...IMAGE_EXT], audio: [...SFX_EXT] },
        });
        return;
      }

      if (name2 === '/api/config' && req.method === 'POST') {
        try {
          const body = await readBody(req);
          const patch = body && typeof body.patch === 'object' && body.patch !== null ? body.patch : {};
          const next = { ...cur(), ...patch };
          liveConfig = next;
          writeConfig(next);
          console.log('[dsh-boot-anim] 设置已保存：' + JSON.stringify(patch));
          sendJson(res, 200, { ok: true, config: next });
        } catch (error) { sendJson(res, 400, { ok: false, error: String((error && error.message) || error) }) }
        return;
      }

      if (name2 === '/api/upload' && req.method === 'POST') {
        const target = url.searchParams.get('target') === 'sfx' ? 'sfx' : 'media';
        const exts = target === 'sfx' ? SFX_EXT : MEDIA_EXT;
        const safe = basename(decodeURIComponent(String(url.searchParams.get('name') || 'upload'))).replace(/[\\/:*?"<>|]/g, '_');
        if (!exts.includes(extname(safe).toLowerCase())) {
          sendJson(res, 400, { ok: false, error: '格式不支持，这里只认：' + exts.join(' ') });
          return;
        }
        const destDir = target === 'sfx' ? SFX_DIR : MEDIA_DIR;
        const dest = join(destDir, safe);
        const ws = createWriteStream(dest);
        req.pipe(ws);
        ws.on('finish', () => {
          if (target === 'media' && needsTranscode(dest, extname(safe))) {
            const out = transcodeHevc(dest, destDir, safe.replace(/\.[^.]+$/, ''));
            if (out.ok) {
              try { mkdirSync(join(ROOT, '_原始素材'), { recursive: true }); renameSync(dest, join(ROOT, '_原始素材', safe)); } catch (e) {}
              sendJson(res, 200, { ok: true, name: out.name, transcoded: true });
              return;
            }
            sendJson(res, 200, { ok: true, name: safe, warning: out.error });
            return;
          }
          sendJson(res, 200, { ok: true, name: safe });
        });
        ws.on('error', (error) => sendJson(res, 500, { ok: false, error: String((error && error.message) || error) }));
        return;
      }

      if (name2 === '/api/import' && req.method === 'POST') {
        try {
          const body = await readBody(req);
          const target = body.target === 'sfx' ? 'sfx' : 'media';
          const src = String(body.path || '');
          const exts = target === 'sfx' ? SFX_EXT : MEDIA_EXT;
          const destDir = target === 'sfx' ? SFX_DIR : MEDIA_DIR;
          if (!existsSync(src) || !statSync(src).isFile()) throw new Error('路径不存在或不是文件');
          if (!exts.includes(extname(src).toLowerCase())) throw new Error('格式不支持，' + target + ' 只认：' + exts.join(' '));
          const safe = basename(src).replace(/[\\/:*?"<>|]/g, '_');
          if (target === 'media' && needsTranscode(src, extname(src))) {
            const out = transcodeHevc(src, destDir, safe.replace(/\.[^.]+$/, ''));
            if (!out.ok) throw new Error(out.error);
            sendJson(res, 200, { ok: true, name: out.name, transcoded: true });
            return;
          }
          copyFileSync(src, join(destDir, safe));
          sendJson(res, 200, { ok: true, name: safe });
        } catch (error) { sendJson(res, 400, { ok: false, error: String((error && error.message) || error) }) }
        return;
      }

      if (name2 === '/api/wct' && req.method === 'GET') {
        sendJson(res, 200, wctStatus(true));
        return;
      }
      if (name2 === '/api/wct/apply' && req.method === 'POST') {
        try { sendJson(res, 200, { ok: true, ...runPatchTool([]) }) }
        catch (error) { sendJson(res, 400, { ok: false, error: String((error && error.message) || error) }) }
        return;
      }
      if (name2 === '/api/wct/revert' && req.method === 'POST') {
        try { sendJson(res, 200, { ok: true, ...runPatchTool(['--revert']) }) }
        catch (error) { sendJson(res, 400, { ok: false, error: String((error && error.message) || error) }) }
        return;
      }
      if (name2 === '/api/uninstall' && req.method === 'POST') {
        try {
          const { dirname } = require2('node:path');
          const dshHome = dirname(dirname(ROOT));
          const profilePath = join(dshHome, 'profiles', 'desktop', 'package.json');
          if (!existsSync(profilePath)) throw new Error('找不到 profile：' + profilePath);
          const pkg = JSON.parse(readFileSync(profilePath, 'utf8'));
          pkg.dsh = pkg.dsh || {};
          pkg.dsh.profile = pkg.dsh.profile || {};
          const bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : [];
          pkg.dsh.profile.bundles = bundles.filter((b) => b !== 'dsh-boot-anim');
          if (pkg.dependencies) delete pkg.dependencies['dsh-boot-anim'];
          writeFileSync(profilePath, JSON.stringify(pkg, null, 2) + '\n');
          console.log('[dsh-boot-anim] 已从 profile 卸载');
          sendJson(res, 200, { ok: true, bundles: pkg.dsh.profile.bundles });
        } catch (error) { sendJson(res, 400, { ok: false, error: String((error && error.message) || error) }) }
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }
      if (name2 === '/asset/media') {
        const file = resolveNow().media;
        if (file === null) { res.writeHead(404); res.end(); return }
        serveFile(req, res, file);
        return;
      }
      if (name2 === '/asset/sfx') {
        const file = resolveNow().sfx;
        if (file === null) { res.writeHead(404); res.end(); return }
        serveFile(req, res, file);
        return;
      }
      res.writeHead(404); res.end();
    },
  }), 'dsh-boot-anim: boot assets + settings api');

  const css = read('boot.css');
  const html = read('boot.html');
  const js = read('boot.js');
  ctx.on('webserver/index-inject', (table) => {
    table.push(
      { kind: 'style', text: css },
      { kind: 'global', name: '__DSH_BOOT_ANIM__', value: buildPayload() },
      { kind: 'html', placement: 'body', html },
      { kind: 'script', placement: 'body', text: js },
    );
  });
}
