/* dsh-boot-anim —— 时序：窗口可见才开播 → 素材 + 音效 → UI 就绪（或按键）后淡出。
   三层兜底：JS 硬上限、CSS 定时淡出、去掉 pointer-events，任何异常都不会挡住界面。 */
(function () {
  var cfg = globalThis.__DSH_BOOT_ANIM__;
  var host = document.getElementById('dsh-boot-overlay');
  if (!host || !cfg) return;

  var MIN = Math.max(0, Number(cfg.minDurationMs) || 3000);
  var waitMediaEnd = cfg.waitForMediaEnd !== false && !!cfg.media;
  var mediaTargetMs = MIN;
  var mediaEnded = false;
  var HARD = Math.max(MIN + 8000, 12000);
  var AUTO_ENTER = Math.max(2000, Number(cfg.autoEnterMs) || 12000);
  var startedAt = 0;
  var finished = false;
  var waiting = false;

  host.setAttribute('data-style', cfg.media ? 'media' : 'plain');

  var titleEl = host.querySelector('.dsh-boot-title');
  var subEl = host.querySelector('.dsh-boot-sub');
  var hintEl = host.querySelector('.dsh-boot-hint');
  var sfxEl = host.querySelector('.dsh-boot-sfx');
  var mediaBox = host.querySelector('.dsh-boot-media');

  if (cfg.title) titleEl.textContent = cfg.title; else titleEl.hidden = true;
  if (cfg.subtitle) subEl.textContent = cfg.subtitle; else subEl.hidden = true;

  /* 旧配置里用的是英文族名，这里做一次兼容映射 */
  var FONT_ALIAS = {
    STXinwei: '华文新魏', STXingkai: '华文行楷', STLiti: '华文隶书', LiSu: '隶书',
    FZShuTi: '方正舒体', KaiTi: '楷体', SimSun: '宋体', STXihei: '华文细黑',
  };
  var fontStack = (function () {
    var id = FONT_ALIAS[cfg.titleFont] || cfg.titleFont;
    /* 兜底只留通用族，绝不再退回另一种书法字体（否则选不中时看起来"没生效"） */
    return id ? '"' + id + '", "Microsoft YaHei", "Segoe UI", serif' : '';
  })();
  if (fontStack) host.style.setProperty('--dsh-boot-title-font', fontStack);
  if (Number(cfg.titleFontSize) > 0) host.style.setProperty('--dsh-boot-title-size', Number(cfg.titleFontSize) + 'px');
  if (Number(cfg.subtitleFontSize) > 0) host.style.setProperty('--dsh-boot-sub-size', Number(cfg.subtitleFontSize) + 'px');

  var videoEl = null;
  var fellBack = false;
  /** 素材加载不出来 → 纯色兜底（v2.0 已移除内置三套动画） */
  function fallbackToPlain() {
    if (fellBack) return;
    fellBack = true;
    try {
      host.classList.remove('has-media');
      host.setAttribute('data-style', 'plain');
      var mb = host.querySelector('.dsh-boot-media');
      if (mb) mb.textContent = '';
      mediaTargetMs = MIN;
      mediaEnded = true;
      HARD = Math.max(MIN + 8000, 12000);
      if (hintEl && cfg.hint) hintEl.hidden = false;
      if (!startedAt) start();
      console.warn('[dsh-boot-anim] 素材不可用，已回退纯色兜底');
    } catch (e) {}
  }
  if (cfg.media) {
    host.classList.add('has-media');
    host.setAttribute('data-fit', cfg.fit === 'contain' ? 'contain' : (cfg.fit === 'blur' ? 'blur' : 'cover'));
    host.style.setProperty('--dsh-boot-object-position',
      cfg.mediaPosition === 'top' ? 'center top' : (cfg.mediaPosition === 'bottom' ? 'center bottom' : 'center center'));
    if (cfg.veil === false) host.classList.add('no-veil');
    if (fontStack && cfg.media) titleEl.style.fontFamily = fontStack;
    if (cfg.titleColor) host.style.setProperty('--dsh-boot-title-color', cfg.titleColor);
    if (cfg.title && cfg.titleDelayMs > 0) {
      host.style.setProperty('--dsh-boot-title-delay', cfg.titleDelayMs + 'ms');
      host.style.setProperty('--dsh-boot-sub-delay', (cfg.titleDelayMs + 220) + 'ms');
      host.style.setProperty('--dsh-boot-track-delay', (cfg.titleDelayMs + 120) + 'ms');
    }
    var blurMode = cfg.fit === 'blur';
    var bgEl = null;
    if (blurMode) {
      if (cfg.mediaKind === 'video') {
        bgEl = document.createElement('video');
        bgEl.src = cfg.media;
        bgEl.muted = true;
        bgEl.loop = cfg.loop !== false;
        bgEl.setAttribute('muted', '');
        bgEl.setAttribute('playsinline', '');
        bgEl.setAttribute('preload', 'auto');
      } else {
        bgEl = document.createElement('div');
        bgEl.style.backgroundImage = 'url("' + cfg.media + '")';
      }
      bgEl.className = 'dsh-boot-media-blur';
      mediaBox.appendChild(bgEl);
    }
    if (cfg.mediaKind === 'video') {
      videoEl = document.createElement('video');
      videoEl.src = cfg.media;
      videoEl.muted = cfg.mediaMuted !== false;
      videoEl.defaultMuted = true;
      videoEl.playsInline = true;
      videoEl.autoplay = true;
      videoEl.loop = cfg.loop !== false && !waitMediaEnd;
      if (videoEl.muted) videoEl.setAttribute('muted', '');
      videoEl.setAttribute('playsinline', '');
      videoEl.setAttribute('preload', 'auto');
      videoEl.addEventListener('error', fallbackToPlain);
      videoEl.addEventListener('loadedmetadata', recomputeTarget);
      videoEl.addEventListener('ended', function () { mediaEnded = true; tick(); });
      videoEl.className = 'dsh-boot-media-main';
      mediaBox.appendChild(videoEl);
      if (bgEl) { var bgPlay = bgEl.play(); if (bgPlay && typeof bgPlay.catch === 'function') bgPlay.catch(function () {}); }
    } else {
      var img = document.createElement('img');
      img.className = 'dsh-boot-media-main';
      img.addEventListener('error', fallbackToPlain);
      img.addEventListener('load', recomputeTarget);
      img.src = cfg.media;
      img.alt = '';
      mediaBox.appendChild(img);
    }
  }


  /* ---------- 第三层 · 闪烁（v2.0） ---------- */
  var flashLayer = null;
  var flashTimers = [];
  var flashStartFired = false;
  var flashAlpha = Math.min(1, Math.max(0, (Number.isFinite(Number(cfg.flashIntensity)) ? Number(cfg.flashIntensity) : 78) / 100));
  var flashPulse = Math.min(1, Math.max(0, (Number.isFinite(Number(cfg.flashPulseIntensity)) ? Number(cfg.flashPulseIntensity) : 16) / 100));
  var flashDur = Math.max(200, Math.min(3000, Number(cfg.flashDurationMs) || 900));
  var flashSpeed = Math.max(1.5, Math.min(10, Number(cfg.flashPulseSpeed) || 4.5));

  function setupFlash() {
    if (cfg.flashEnabled === false) return;
    flashLayer = document.createElement('div');
    flashLayer.className = 'dsh-boot-flash-layer';
    flashLayer.setAttribute('aria-hidden', 'true');
    flashLayer.style.setProperty('--flash-color', /^#[0-9a-f]{6}$/i.test(String(cfg.flashColor || '')) ? cfg.flashColor : '#dff8ff');
    flashLayer.style.setProperty('--flash-alpha', String(flashAlpha));
    flashLayer.style.setProperty('--flash-duration', flashDur + 'ms');
    flashLayer.style.setProperty('--flash-pulse', String(flashPulse));
    flashLayer.style.setProperty('--flash-speed', flashSpeed + 's');
    flashLayer.innerHTML = '<div class="flash-edge"></div><div class="flash-core"></div><div class="flash-sweep"></div>'
      + (cfg.flashRing === false ? '' : '<div class="flash-ring"></div>');
    host.appendChild(flashLayer);
    if (cfg.flashPulse !== false && flashPulse > 0) flashLayer.classList.add('is-pulsing');
  }

  function clearFlashTimers() {
    for (var fi = 0; fi < flashTimers.length; fi++) { try { clearTimeout(flashTimers[fi]); } catch (e) {} }
    flashTimers = [];
  }

  function fireFlash(delay, soft) {
    if (!flashLayer) return;
    flashTimers.push(setTimeout(function () {
      if (!flashLayer) return;
      try {
        flashLayer.classList.toggle('is-soft', !!soft);
        flashLayer.classList.remove('is-firing');
        void flashLayer.offsetWidth;
        flashLayer.classList.add('is-firing');
      } catch (e) {}
    }, Math.max(0, delay)));
  }

  function armFlash() {
    if (!flashLayer) return;
    clearFlashTimers();
    var at = cfg.flashAt || 'both';
    if ((at === 'start' || at === 'both') && !flashStartFired) { flashStartFired = true; fireFlash(220, true); }
    if (at === 'end' || at === 'both') fireFlash(Math.max(0, mediaTargetMs - flashDur - 120), false);
  }

  setupFlash();

  var audio = null;
  var sfxOffered = false;
  var sfxStarted = false;
  var vol = Math.min(1, Math.max(0, typeof cfg.sfxVolume === 'number' ? cfg.sfxVolume : 0.7));
  var sfxStartMs = Math.max(0, Number(cfg.sfxStartMs) || 0);
  var sfxDurationMs = Math.max(0, Number(cfg.sfxDurationMs) || 0);
  var sfxFadeMs = Math.max(0, Number(cfg.sfxFadeOutMs) || 0);

  function sfxFadeOut(ms, pauseAfter) {
    if (!audio) return;
    var total = Math.max(160, ms);
    var steps = Math.max(4, Math.round(total / 40));
    var from = audio.volume;
    var done = 0;
    var timer = setInterval(function () {
      done++;
      try { audio.volume = Math.max(0, from * (1 - done / steps)); } catch (e) {}
      if (done >= steps) { clearInterval(timer); if (pauseAfter) { try { audio.pause(); } catch (e) {} } }
    }, total / steps);
  }

  function playSfx() {
    if (!cfg.sfx || sfxStarted) return;
    if (!audio) {
      audio = new Audio();
      audio.preload = 'auto';
      audio.src = cfg.sfx;
      audio.volume = vol;
    }
    var begin = function () {
      if (sfxStarted) return;
      sfxStarted = true;
      if (sfxStartMs > 0) { try { audio.currentTime = sfxStartMs / 1000; } catch (e) {} }
      try { audio.volume = vol; } catch (e) {}
      var played = audio.play();
      if (played && typeof played.catch === 'function') {
        played.catch(function () { sfxStarted = false; if (sfxOffered) return; sfxOffered = true; offerSfxGesture(); });
      }
      if (sfxDurationMs > 0) setTimeout(function () { sfxFadeOut(sfxFadeMs, true); }, Math.max(0, sfxDurationMs - sfxFadeMs));
    };
    if (sfxStartMs === 0 || audio.readyState >= 1) begin();
    else {
      audio.addEventListener('loadedmetadata', begin, { once: true });
      setTimeout(function () { if (!sfxStarted) begin(); }, 1000);
    }
  }
  function offerSfxGesture() {
    if (!sfxEl) return;
    sfxEl.textContent = '🔊 点击任意处播放开场音';
    sfxEl.hidden = false;
    var once = function () {
      sfxEl.hidden = true;
      window.removeEventListener('pointerdown', once, true);
      window.removeEventListener('keydown', once, true);
      try { if (audio) { audio.currentTime = sfxStartMs / 1000; audio.play(); } } catch (e) {}
    };
    window.addEventListener('pointerdown', once, true);
    window.addEventListener('keydown', once, true);
  }

  function recomputeTarget() {
    if (!waitMediaEnd) return;
    var next = MIN;
    /* 用户明确填了「播多久」→ 完全按他填的来（不再被"最短时长"抬高，也不再设上限） */
    if (Number(cfg.mediaDurationMs) > 0) next = Math.round(Number(cfg.mediaDurationMs));
    else if (videoEl && isFinite(videoEl.duration) && videoEl.duration > 0) {
      /* 没填「播多久」→ 视频多长就播多长（减去起点），同样不设上限 */
      next = Math.max(1000, Math.round(videoEl.duration * 1000 - (Number(cfg.mediaStartMs) || 0)));
    }
    if (next === mediaTargetMs) return;
    mediaTargetMs = next;
    HARD = mediaTargetMs + 8000;
    if (startedAt) armFlash();
    try {
      host.style.setProperty('--dsh-boot-progress-duration', mediaTargetMs + 'ms');
      if (startedAt) host.style.animation = 'dsh-boot-out .55s ease ' + (HARD + 1500) + 'ms forwards';
    } catch (e) {}
  }

  function isVisible() { return document.visibilityState === 'visible'; }
  function uiReady() {
    var root = document.getElementById('root');
    return !!root && root.childElementCount > 0;
  }

  function armSkip() {
    if (cfg.skippable === false) return;
    var allowAt = Date.now() + 3000;
    var go = function () { if (Date.now() >= allowAt) finish(); };
    window.addEventListener('pointerdown', go, true);
    window.addEventListener('keydown', go, true);
  }

  function start() {
    if (startedAt || finished) return;
    startedAt = Date.now();
    host.classList.add('dsh-boot-run');
    recomputeTarget();
    armFlash();
    if (mediaTargetMs > 0) host.style.setProperty('--dsh-boot-progress-duration', mediaTargetMs + 'ms');
    armSkip();
    if (cfg.hint && hintEl) {
      /* 全程显示 + 呼吸闪烁，直到开屏结束（视频播完） */
      hintEl.textContent = cfg.hint;
      setTimeout(function () { hintEl.hidden = false; }, 1000);
    }
    host.style.animation = 'dsh-boot-out .55s ease ' + (cfg.waitForInput ? AUTO_ENTER + 3000 : HARD + 1500) + 'ms forwards';
    playSfx();
    if (videoEl) {
      /* 大体积本地视频首帧可能超过 8 秒：只在真实 error 时回退，不因加载慢误判 */
      var played = videoEl.play();
      if (played && typeof played.catch === 'function') {
        played.catch(function () {
          /* 带声音的自动播放被系统拦住 → 退回静音播放，画面不受影响 */
          try { videoEl.muted = true; videoEl.setAttribute('muted', ''); var again = videoEl.play(); if (again && again.catch) again.catch(function () {}); } catch (e) {}
        });
      }
    }
    setTimeout(tick, MIN + 60);
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearFlashTimers();
    try {
      host.style.animation = 'none';
      host.style.transition = 'opacity .5s ease';
      host.style.pointerEvents = 'none';
      host.style.opacity = '0';
      if (audio) sfxFadeOut(Math.min(sfxFadeMs || 450, 500), true);
      setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 700);
    } catch (e) {}
  }

  function tick() {
    if (finished || waiting) return;
    var waited = Date.now() - startedAt;
    if (waited < mediaTargetMs) { setTimeout(tick, 120); return; }
    if (cfg.waitForInput) { enterWaiting(); return; }
    if (mediaEnded && uiReady()) { finish(); return; }
    if (uiReady() || waited >= HARD) { finish(); return; }
    setTimeout(tick, 120);
  }

  function enterWaiting() {
    if (waiting || finished) return;
    waiting = true;
    if (hintEl) { hintEl.textContent = cfg.hint || '点击或按任意键进入'; hintEl.hidden = false; }
    var go = function () {
      window.removeEventListener('pointerdown', go, true);
      window.removeEventListener('keydown', go, true);
      finish();
    };
    window.addEventListener('pointerdown', go, true);
    window.addEventListener('keydown', go, true);
    setTimeout(go, AUTO_ENTER);
  }

  if (isVisible()) start();
  else document.addEventListener('visibilitychange', function () { if (isVisible()) start(); });
  setTimeout(start, 5000);
  setTimeout(finish, 40000);

  /* 调试/自检钩子：控制台可查 __dshBootAnim.state() */
  try {
    globalThis.__dshBootAnim = {
      cfg: cfg,
      finish: finish,
      state: function () {
        return {
          startedAt: startedAt,
          finished: finished,
          waiting: waiting,
          sfxStarted: sfxStarted,
          mediaTargetMs: mediaTargetMs,
          mediaEnded: mediaEnded,
          videoDuration: videoEl && isFinite(videoEl.duration) ? Math.round(videoEl.duration * 1000) : null,
          audioTime: audio ? Math.round(audio.currentTime * 1000) : null,
          audioDuration: audio && isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null,
          volume: audio ? Number(audio.volume.toFixed(3)) : null,
          paused: audio ? audio.paused : null,
        };
      },
    };
  } catch (e) {}
})();
