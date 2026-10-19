/* dsh-boot-anim · 设置页面板：开屏动画 / 素材 / 音乐 / 字体颜色 / 卸载。
   契约：浏览器半侧必须是「普通副作用脚本」—— 加载时调用 window.__ModuleLoader__.load，
   不能有顶层 import/export；react 由 factory 的 require 取得。 */
(function () {
  if (!window.__ModuleLoader__ || typeof window.__ModuleLoader__.load !== 'function') {
    console.warn('[dsh-boot-anim] 模块系统不可用，跳过设置面板');
    return;
  }

  window.__ModuleLoader__.load({
    id: 'dsh-boot-anim',
    factory: function (require) {
      var module = { exports: {} };
      try {
        var react = require('react');
        var useState = react.useState;
        var useEffect = react.useEffect;
        var useCallback = react.useCallback;
        var h = require('react/jsx-runtime').jsx;
        var API = '/dsh-boot-anim';

        /* createElement 风格包装（jsx 运行时只认 props.children） */
        var el = function (type, props) {
          var children = Array.prototype.slice.call(arguments, 2);
          var next = {};
          for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) next[k] = props[k];
          if (children.length === 1) next.children = children[0];
          else if (children.length > 1) next.children = children;
          return h(type, next);
        };
        var arr = function () { return Array.prototype.slice.call(arguments) };

        var CSS_ID = 'dsh-boot-anim-panel-css';
        function ensureCss() {
          if (document.getElementById(CSS_ID)) return;
          var style = document.createElement('style');
          style.id = CSS_ID;
          style.textContent = [
            '.bap{max-width:720px;display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}',
            '.bap-card{border:1px solid var(--dsw-alias-border-l4);border-radius:12px;padding:14px 16px;background:var(--dsw-alias-bg-layer-1)}',
            '.bap-h{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--dsw-alias-label-primary)}',
            '.bap-row{display:flex;align-items:center;gap:12px;justify-content:space-between;min-height:34px;padding:4px 0}',
            '.bap-row>.bap-label{flex:0 0 168px;color:var(--dsw-alias-label-secondary)}',
            '.bap-ctl{flex:1;display:flex;align-items:center;gap:8px;min-width:0}',
            '.bap select,.bap input[type=text],.bap input[type=number]{height:32px;min-width:0;flex:1;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit}',
            '.bap input[type=range]{flex:1;accent-color:var(--dsw-alias-brand-primary)}',
            '.bap input[type=checkbox]{width:16px;height:16px;accent-color:var(--dsw-alias-brand-primary)}',
            '.bap input[type=color]{width:34px;height:26px;flex:0 0 34px;padding:0;border:1px solid var(--dsw-alias-border-l4);border-radius:6px;background:none;cursor:pointer}',
            '.bap-btn{height:32px;padding:0 14px;border-radius:8px;border:1px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;white-space:nowrap}',
            '.bap-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
            '.bap-btn.primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:transparent}',
            '.bap-btn.danger{color:#e0574a;border-color:rgba(224,87,74,.45)}',
            '.bap-btn.danger:hover{background:rgba(224,87,74,.10)}',
            '.bap-hint{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:18px}',
            '.bap-msg{font-size:12px;padding:8px 10px;border-radius:8px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);word-break:break-all}',
            '.bap-warn{font-size:12px;line-height:18px;color:#c0392b;background:rgba(192,57,43,.08);border-radius:8px;padding:8px 10px;margin:2px 0 4px}',
            '.bap-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
            '.bap-num{max-width:110px;flex:0 0 110px}',
            '.bap-swatch{width:22px;height:22px;border-radius:6px;border:1px solid var(--dsw-alias-border-l4);cursor:pointer;padding:0;flex:0 0 22px}',
            '.bap-ok{font-size:13px;font-weight:600;color:#2e9e5b}',
            '.bap-flash-preview{position:fixed;inset:0;z-index:2147483600;pointer-events:none;mix-blend-mode:screen;background:radial-gradient(circle at 50% 50%, var(--bap-flash-color) 0%, color-mix(in srgb, var(--bap-flash-color) 62%, transparent) 20%, transparent 64%);opacity:0;animation:bap-flash-burst var(--bap-flash-duration) cubic-bezier(.2,.7,.2,1) forwards}',
            '@keyframes bap-flash-burst{0%{opacity:0;transform:scale(.92)}18%{opacity:var(--bap-flash-alpha)}55%{opacity:calc(var(--bap-flash-alpha)*.55)}100%{opacity:0;transform:scale(1.12)}}',
          ].join('');
          document.head.appendChild(style);
        }

        function Row(props) {
          return el('div', { className: 'bap-row' },
            el('div', { className: 'bap-label' }, props.label),
            el('div', { className: 'bap-ctl' }, props.children));
        }

        function Panel() {
          ensureCss();
          var st = useState(null); var state = st[0]; var setState = st[1];
          var sm = useState(''); var msg = sm[0]; var setMsg = sm[1];
          /* 服务端返回的原始配置快照 —— 保存时用它做对比基准（之前误用当前 state，导致永远判定"没有改动"） */
          var sbc = useState(null); var baseConfig = sbc[0]; var setBaseConfig = sbc[1];
          var sp = useState(''); var importPath = sp[0]; var setImportPath = sp[1];
          var stg = useState('media'); var importTarget = stg[0]; var setImportTarget = stg[1];
          var sb = useState(false); var busy = sb[0]; var setBusy = sb[1];
          var sf = useState(null); var pendingFile = sf[0]; var setPendingFile = sf[1];
          var sis = useState('idle'); var importState = sis[0]; var setImportState = sis[1];
          var sua = useState(false); var uninstallArmed = sua[0]; var setUninstallArmed = sua[1];
          var swc = useState(null); var wct = swc[0]; var setWct = swc[1];
          var swca = useState(false); var wctArmed = swca[0]; var setWctArmed = swca[1];

          var loadWct = useCallback(function () {
            fetch(API + '/api/wct').then(function (r2) { return r2.json() }).then(function (data) { setWct(data) }).catch(function () {});
          }, []);

          var load = useCallback(function () {
            fetch(API + '/api/state').then(function (r) { return r.json() }).then(function (data) {
              setState(data);
              setBaseConfig(data.config || {});
            }).catch(function (e) { setMsg('读取配置失败：' + e.message) });
            loadWct();
          }, []);
          useEffect(function () { load(); loadWct() }, [load, loadWct]);

          if (!state) {
            return el('div', { className: 'bap' }, el('div', { className: 'bap-hint' }, '正在读取开屏动画配置…'));
          }

          var cfg = state.config || {};
          var files = state.files || { media: [], sfx: [] };
          var mediaFiles = files.media || [];
          var sfxFiles = files.sfx || [];
          var fonts = state.fonts || [];
          var sup = state.supported || { video: [], image: [], audio: [] };
          var missing = state.missing || {};

          var set = function (patch) {
            setState(Object.assign({}, state, { config: Object.assign({}, cfg, patch) }));
          };
          var num = function (v) { var n = Number(v); return isFinite(n) ? n : 0 };
          var sec = function (ms) { return num(ms) / 1000 };
          var option = function (v, label) { return el('option', { value: v, key: String(v) }, label) };
          var withMissing = function (value, list, autoLabel, noneLabel) {
            var out = [option('auto', autoLabel), option('none', noneLabel)];
            if (value && value !== 'auto' && value !== 'none' && value !== false && list.indexOf(value) === -1) {
              out.push(option(value, '⚠ ' + value + '（文件不存在）'));
            }
            return out.concat(list.map(function (n) { return option(n, n) }));
          };

          var save = function (reload) {
            /* 以输入框里的真实文本为准：即便 onChange 没触发（中文输入法组合、粘贴、自动填充），也能保存正确内容 */
            var fromDom = {};
            ['hint', 'title', 'subtitle'].forEach(function (k) {
              var node = document.querySelector('[data-field="' + k + '"]');
              if (node) fromDom[k] = node.value;
            });
            var live = Object.assign({}, cfg, fromDom);
            setState(Object.assign({}, state, { config: live }));

            var base = baseConfig || (state.config || {});
            var patch = {};
            Object.keys(live).forEach(function (k) {
              if (JSON.stringify(live[k]) !== JSON.stringify(base[k])) patch[k] = live[k];
            });
            if (Object.keys(patch).length === 0) {
              setMsg('没有检测到改动：' + '主标题=' + JSON.stringify(live.title) + ' 提示=' + JSON.stringify(live.hint) + '（若确实改过，请把输入框里的文字重新输入一次再点保存）');
              return;
            }
            setBusy(true);
            setMsg('正在保存 ' + Object.keys(patch).length + ' 项：' + Object.keys(patch).join('、'));
            fetch(API + '/api/config', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ patch: patch }),
            }).then(function (r) { return r.json() }).then(function (res) {
              setBusy(false);
              if (!res.ok) { setMsg('保存失败：' + (res.error || '未知错误')); return }
              setState(Object.assign({}, state, { config: res.config }));
              setBaseConfig(res.config || {});
              setMsg(reload ? '已保存：' + Object.keys(patch).join('、') + '，正在刷新界面…' : '已保存 ✓ 改了：' + Object.keys(patch).join('、') + '（重启 DSH 或点「保存并立即生效」生效）');
              if (reload) setTimeout(function () { location.reload() }, 500);
            }).catch(function (e) { setBusy(false); setMsg('保存失败：' + e.message) });
          };

          var applyImported = function (name) {
            var patch = {};
            patch[importTarget === 'sfx' ? 'sfx' : 'media'] = name;
            fetch(API + '/api/config', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ patch: patch }),
            }).then(function () { load() }).catch(function () {});
          };

          var pickFile = function (accept) {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.style.display = 'none';
            document.body.appendChild(input);
            input.onchange = function () {
              var file = input.files && input.files[0];
              try { document.body.removeChild(input) } catch (e) {}
              if (!file) return;
              setPendingFile(file);
              setImportPath(file.name);
              setImportState('idle');
              setMsg('已选择「' + file.name + '」（' + (file.size / 1048576).toFixed(1) + ' MB）→ 点「② 确定导入」开始上传');
            };
            input.click();
          };

          var uploadPending = function () {
            var file = pendingFile;
            setBusy(true);
            setImportState('uploading');
            setMsg('正在上传「' + file.name + '」…');
            var xhr = new XMLHttpRequest();
            xhr.open('POST', API + '/api/upload?target=' + importTarget + '&name=' + encodeURIComponent(file.name));
            xhr.upload.onprogress = function (ev) {
              if (ev.lengthComputable) setMsg('正在上传「' + file.name + '」 ' + Math.round((ev.loaded / ev.total) * 100) + '%');
            };
            xhr.onload = function () {
              setBusy(false);
              var res;
              try { res = JSON.parse(xhr.responseText) } catch (e) { setImportState('idle'); setMsg('导入失败：' + e.message); return }
              if (!res.ok) { setImportState('idle'); setMsg('导入失败：' + (res.error || '未知错误')); return }
              setImportState('done');
              setPendingFile(null);
              setImportPath('');
              setMsg('已导入「' + res.name + '」' + (res.transcoded ? '（已自动转成 H.264）' : '') + '，并已设为当前' + (importTarget === 'sfx' ? '音乐' : '素材') + ' ✓ —— 点「保存并立即生效」就能看到');
              applyImported(res.name);
              setTimeout(function () { setImportState('idle') }, 2500);
            };
            xhr.onerror = function () { setBusy(false); setImportState('idle'); setMsg('上传失败，请重试') };
            xhr.send(file);
          };

          var importByPath = function () {
            if (!importPath.trim()) { setMsg('先用「① 选择文件…」挑一个，或把完整路径粘到框里'); return }
            setBusy(true);
            setMsg('正在复制文件…');
            fetch(API + '/api/import', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ target: importTarget, path: importPath.trim() }),
            }).then(function (r) { return r.json() }).then(function (res) {
              setBusy(false);
              if (!res.ok) { setMsg('导入失败：' + (res.error || '未知错误')); return }
              setMsg('已导入「' + res.name + '」，并已设为当前' + (importTarget === 'sfx' ? '音乐' : '素材') + ' ✓');
              setImportPath('');
              applyImported(res.name);
            }).catch(function (e) { setBusy(false); setMsg('导入失败：' + e.message) });
          };

          var doImport = function () {
            if (pendingFile) { uploadPending(); return }
            importByPath();
          };

          var doWct = function (action) {
            if (!wctArmed) {
              setWctArmed(true);
              setMsg(action === 'apply'
                ? '再点一次「确认应用」：脚本会等你退出 DSH 后自动打补丁并重新启动它'
                : '再点一次「确认还原」：脚本会等你退出 DSH 后还原官方文件并重新启动它');
              setTimeout(function () { setWctArmed(false) }, 6000);
              return;
            }
            setBusy(true);
            setMsg('正在启动脚本…');
            fetch(API + '/api/wct/' + action, { method: 'POST' })
              .then(function (r2) { return r2.json() })
              .then(function (res) {
                setBusy(false);
                setWctArmed(false);
                if (!res.ok) { setMsg('操作失败：' + (res.error || '未知错误')); return }
                setMsg(action === 'apply'
                  ? '补丁脚本已就绪 ✓ 现在请「完全退出 DeepSeek Harness」（托盘图标右键退出）—— 脚本会在检测到退出后自动打补丁并重新启动它，约 10 秒后回来'
                  : '还原脚本已就绪 ✓ 现在请完全退出 DeepSeek Harness —— 脚本会自动还原并重启它');
                setTimeout(loadWct, 3000);
              })
              .catch(function (e) { setBusy(false); setWctArmed(false); setMsg('操作失败：' + e.message) });
          };

          var doUninstall = function () {
            if (!uninstallArmed) {
              setUninstallArmed(true);
              setMsg('再点一次「确认卸载」就会把插件从 profile 里移除（重启后生效，开屏动画恢复官方原样）');
              setTimeout(function () { setUninstallArmed(false) }, 6000);
              return;
            }
            setBusy(true);
            setMsg('正在卸载…');
            fetch(API + '/api/uninstall', { method: 'POST' })
              .then(function (r) { return r.json() })
              .then(function (res) {
                setBusy(false);
                if (!res.ok) { setMsg('卸载失败：' + (res.error || '未知错误')); return }
                setMsg('已从 profile 移除 ✓ 重启 DeepSeek Harness 后开屏动画恢复官方原样；插件目录可手动删除');
              })
              .catch(function (e) { setBusy(false); setMsg('卸载失败：' + e.message) });
          };

          var cardAnim = el('div', { className: 'bap-card', key: 'card-anim' }, arr(
            el('div', { className: 'bap-h', key: 'h' }, '① 开屏动画'),
            el(Row, { key: 'enable', label: '启用开屏' },
              el('input', { type: 'checkbox', checked: cfg.enabled !== false, onChange: function (e) { set({ enabled: e.target.checked }) } }),
              el('span', { className: 'bap-hint' }, '关掉就恢复官方原样')),
            el(Row, { key: 'source', label: '动画来源' },
              el('span', { className: 'bap-hint' }, '自定义素材（视频 / 图片）——内置三套动画已移除')),
            el(Row, { key: 'dur', label: '兜底时长（秒）' },
              el('input', { className: 'bap-num', type: 'number', min: 0, step: 1, value: sec(cfg.minDurationMs), onChange: function (e) { set({ minDurationMs: Math.round(num(e.target.value) * 1000) }) } }),
              el('span', { className: 'bap-hint' }, '素材加载失败时至少展示多久；正常有素材时以素材时长为准')),
            el(Row, { key: 'skip', label: '可跳过' },
              el('input', { type: 'checkbox', checked: cfg.skippable !== false, onChange: function (e) { set({ skippable: e.target.checked }) } }),
              el('span', { className: 'bap-hint' }, '播放中按任意键 / 点击可立即进入（前 3 秒防误触）')),
            el(Row, { key: 'hint', label: '提示文字' },
              el('input', { type: 'text', 'data-field': 'hint', value: cfg.hint || '', onChange: function (e) { set({ hint: e.target.value }) } }))));

          var cardMedia = el('div', { className: 'bap-card', key: 'card-media' }, arr(
            el('div', { className: 'bap-h', key: 'h' }, '② 动画素材（视频 / 图片）'),
            el(Row, { key: 'cur', label: '当前素材' },
              el('select', { value: cfg.media || 'auto', onChange: function (e) { set({ media: e.target.value }) } },
                withMissing(cfg.media, mediaFiles, '自动（media 目录第一个）', '不用素材（纯色兜底）'))),
            (missing.media ? el('div', { key: 'warn', className: 'bap-warn' }, '⚠ 配置的素材文件已经不在了（被移动或删除）。开屏会自动回退到纯色兜底，建议重新选择素材，或把「当前素材」改成「自动」。') : null),
            el('div', { key: 'fmt', className: 'bap-hint' },
              '可用格式：' + (sup.video || []).join(' ') + ' ｜ 图片：' + (sup.image || []).join(' ') + ' ｜ 不能直接播的（HEVC、mkv、avi、wmv…）会自动转成 H.264 mp4'),
            el(Row, { key: 'pick', label: '导入素材' },
              el('select', { className: 'bap-num', value: importTarget, onChange: function (e) { setImportTarget(e.target.value); setPendingFile(null); setImportPath('') } },
                option('media', '视频 / 图片'), option('sfx', '音乐')),
              el('button', { className: 'bap-btn', disabled: busy, onClick: function () { pickFile(importTarget === 'sfx' ? 'audio/*' : 'video/*,image/*') } }, '① 选择文件…'),
              el('span', { className: 'bap-hint' }, '会弹出系统文件选择框')),
            el(Row, { key: 'confirm', label: '已选文件' },
              el('input', { type: 'text', placeholder: '还没选文件（也可把完整路径粘到这里）', value: importPath, onChange: function (e) { setPendingFile(null); setImportPath(e.target.value) } }),
              el('button', { className: 'bap-btn primary', disabled: busy, onClick: doImport },
                importState === 'uploading' ? '导入中…' : (importState === 'done' ? '已导入 ✓' : '② 确定导入'))),
            el(Row, { key: 'start', label: '从哪里开始（秒）' },
              el('input', { className: 'bap-num', type: 'number', min: 0, step: 0.5, value: sec(cfg.mediaStartMs), onChange: function (e) { set({ mediaStartMs: Math.round(num(e.target.value) * 1000) }) } }),
              el('span', { className: 'bap-hint' }, '视频太长时跳过片头')),
            el(Row, { key: 'mdur', label: '播多久（秒）' },
              el('input', { className: 'bap-num', type: 'number', min: 0, step: 0.5, value: sec(cfg.mediaDurationMs), onChange: function (e) { set({ mediaDurationMs: Math.round(num(e.target.value) * 1000) }) } }),
              el('span', { className: 'bap-hint' }, '0 = 播完为止')),
            el(Row, { key: 'fit', label: '画面铺满方式' },
              el('select', { value: cfg.fit || 'cover', onChange: function (e) { set({ fit: e.target.value }) } },
                option('cover', '铺满裁切 · 最沉浸（边缘会被裁掉）'),
                option('blur', '模糊填充 · 无黑边也不裁画面（竖屏推荐）'),
                option('contain', '完整显示 · 留黑边'))),
            el(Row, { key: 'pos', label: '裁切焦点' },
              el('select', { value: cfg.mediaPosition || 'center', onChange: function (e) { set({ mediaPosition: e.target.value }) } },
                option('center', '居中'), option('top', '偏上（保住头部/标题）'), option('bottom', '偏下（保住下半身/字幕）')),
              el('span', { className: 'bap-hint' }, '仅「铺满裁切」时有效')),
            el(Row, { key: 'mute', label: '素材原声' },
              el('select', { value: cfg.mediaMuted === false ? 'off' : 'on', onChange: function (e) { set({ mediaMuted: e.target.value === 'on' }) } },
                option('on', '静音（用下面的音乐）'), option('off', '播放素材自带的声音'))),
            el(Row, { key: 'waitend', label: '等素材播完再进入' },
              el('input', { type: 'checkbox', checked: cfg.waitForMediaEnd !== false, onChange: function (e) { set({ waitForMediaEnd: e.target.checked }) } }),
              el('span', { className: 'bap-hint' }, '开 = 视频完整播完才进界面（此时忽略循环）；关 = 只按上面「时长」计时')),
            el(Row, { key: 'loop', label: '循环播放' },
              el('input', { type: 'checkbox', checked: cfg.loop !== false, onChange: function (e) { set({ loop: e.target.checked }) } }))));

          var flashSwatches = ['#dff8ff', '#7fe4ff', '#3a7bff', '#39ffd1', '#ffffff', '#ffd9a0'].map(function (c3) {
            return el('button', { key: 'fsw' + c3, className: 'bap-swatch', style: { background: c3 }, title: c3, onClick: function () { set({ flashColor: c3 }) } });
          });
          var skinId = '';
          try { skinId = document.documentElement.getAttribute('data-dsh-skin') || document.body.getAttribute('data-dsh-skin') || '' } catch (e) {}
          var skinStatus = skinId
            ? '皮肤层：已检测到「' + skinId + '」；开屏结束后保留当前皮肤。'
            : '皮肤层：未检测到皮肤中心标记；如果你用的是 dsh-dream-skin 或其它 token 皮肤，开屏结束后仍会保留它。';
          function toHexColor(v) {
            if (!v) return '';
            if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
            var m = String(v).match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
            if (!m) return '';
            return '#' + [1, 2, 3].map(function (i) {
              var n = Math.max(0, Math.min(255, Number(m[i]))).toString(16);
              return n.length < 2 ? '0' + n : n;
            }).join('');
          }
          var pickSkinColor = function () {
            try {
              var cs = getComputedStyle(document.documentElement);
              var names = ['--dsw-alias-brand-primary', '--dsw-alias-accent', '--dsw-alias-color-accent', '--dsw-brand-primary', '--we-accent'];
              for (var i = 0; i < names.length; i++) {
                var hex = toHexColor(cs.getPropertyValue(names[i]).trim());
                if (hex) { set({ flashColor: hex }); setMsg('已从皮肤取色：' + hex); return; }
              }
              setMsg('当前皮肤没有暴露主色，手动选一个颜色。');
            } catch (e) { setMsg('读取皮肤颜色失败：' + e.message); }
          };
          var previewFlash = function () {
            try {
              var d = document.createElement('div');
              d.className = 'bap-flash-preview';
              d.style.setProperty('--bap-flash-color', cfg.flashColor || '#dff8ff');
              d.style.setProperty('--bap-flash-alpha', String(Math.max(0, Math.min(100, Number.isFinite(Number(cfg.flashIntensity)) ? Number(cfg.flashIntensity) : 78)) / 100));
              d.style.setProperty('--bap-flash-duration', Math.max(200, Math.min(3000, Number(cfg.flashDurationMs) || 900)) + 'ms');
              document.body.appendChild(d);
              setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, Math.max(200, Math.min(3000, Number(cfg.flashDurationMs) || 900)) + 400);
            } catch (e) {}
          };
          var cardFlash = el('div', { className: 'bap-card', key: 'card-flash' }, arr(
            el('div', { className: 'bap-h', key: 'h' }, '③ 第三层 · 闪烁'),
            el('div', { key: 'desc', className: 'bap-hint' }, '冷白数据闪：片头轻闪 + 全片呼吸 + 片尾 0.9s 爆闪 + 冷色光环。颜色建议跟皮肤主色一致。'),
            el(Row, { key: 'on', label: '启用闪烁' },
              el('input', { type: 'checkbox', checked: cfg.flashEnabled !== false, onChange: function (e) { set({ flashEnabled: e.target.checked }) } }),
              el('span', { className: 'bap-hint' }, '关掉只保留视频/图片')),
            el(Row, { key: 'color', label: '闪烁颜色' },
              el('input', { type: 'color', value: cfg.flashColor || '#dff8ff', onChange: function (e) { set({ flashColor: e.target.value }) } }),
              flashSwatches,
              el('button', { className: 'bap-btn', onClick: pickSkinColor }, '从皮肤取色')),
            el(Row, { key: 'int', label: '爆闪强度' },
              el('input', { type: 'range', min: 0, max: 100, step: 1, value: Number.isFinite(Number(cfg.flashIntensity)) ? Number(cfg.flashIntensity) : 78, onChange: function (e) { set({ flashIntensity: Number(e.target.value) }) } }),
              el('span', { className: 'bap-hint' }, (Number.isFinite(Number(cfg.flashIntensity)) ? Number(cfg.flashIntensity) : 78) + '%')),
            el(Row, { key: 'dur', label: '爆闪时长' },
              el('input', { className: 'bap-num', type: 'number', min: 200, max: 3000, step: 100, value: Number.isFinite(Number(cfg.flashDurationMs)) ? Number(cfg.flashDurationMs) : 900, onChange: function (e) { set({ flashDurationMs: Math.round(num(e.target.value)) }) } }),
              el('span', { className: 'bap-hint' }, 'ms；200–3000')),
            el(Row, { key: 'at', label: '触发时机' },
              el('select', { value: cfg.flashAt || 'both', onChange: function (e) { set({ flashAt: e.target.value }) } },
                option('end', '片尾爆闪'), option('start', '片头爆闪'), option('both', '片头 + 片尾'), option('off', '不爆闪（只呼吸）'))),
            el(Row, { key: 'pulse', label: '呼吸光' },
              el('input', { type: 'checkbox', checked: cfg.flashPulse !== false, onChange: function (e) { set({ flashPulse: e.target.checked }) } }),
              el('input', { type: 'range', min: 0, max: 100, step: 1, value: Number.isFinite(Number(cfg.flashPulseIntensity)) ? Number(cfg.flashPulseIntensity) : 16, onChange: function (e) { set({ flashPulseIntensity: Number(e.target.value) }) } }),
              el('span', { className: 'bap-hint' }, (Number.isFinite(Number(cfg.flashPulseIntensity)) ? Number(cfg.flashPulseIntensity) : 16) + '%')),
            el(Row, { key: 'speed', label: '呼吸速度' },
              el('input', { className: 'bap-num', type: 'number', min: 1.5, max: 10, step: 0.5, value: Number.isFinite(Number(cfg.flashPulseSpeed)) ? Number(cfg.flashPulseSpeed) : 4.5, onChange: function (e) { set({ flashPulseSpeed: num(e.target.value) }) } }),
              el('span', { className: 'bap-hint' }, '秒 / 次')),
            el(Row, { key: 'ring', label: '光环' },
              el('input', { type: 'checkbox', checked: cfg.flashRing !== false, onChange: function (e) { set({ flashRing: e.target.checked }) } }),
              el('span', { className: 'bap-hint' }, '爆闪时扩散一圈冷色光环')),
            el(Row, { key: 'preview', label: '预览' },
              el('button', { className: 'bap-btn primary', onClick: previewFlash }, '预览闪烁'),
              el('span', { className: 'bap-hint' }, '只预览爆闪，不改配置')),
            el('div', { key: 'skin', className: 'bap-hint' }, skinStatus)));

          var cardSfx = el('div', { className: 'bap-card', key: 'card-sfx' }, arr(
            el('div', { className: 'bap-h', key: 'h' }, '④ 音乐'),
            el(Row, { key: 'cur', label: '当前音乐' },
              el('select', { value: cfg.sfx || 'auto', onChange: function (e) { set({ sfx: e.target.value }) } },
                withMissing(cfg.sfx, sfxFiles, '自动（sfx 目录第一个）', '静音'))),
            el(Row, { key: 'vol', label: '音量' },
              el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: typeof cfg.sfxVolume === 'number' ? cfg.sfxVolume : 0.7, onChange: function (e) { set({ sfxVolume: Number(e.target.value) }) } }),
              el('span', { className: 'bap-hint' }, Math.round((typeof cfg.sfxVolume === 'number' ? cfg.sfxVolume : 0.7) * 100) + '%')),
            el(Row, { key: 'start', label: '副歌起点（秒）' },
              el('input', { className: 'bap-num', type: 'number', min: 0, step: 0.5, value: sec(cfg.sfxStartMs), onChange: function (e) { set({ sfxStartMs: Math.round(num(e.target.value) * 1000) }) } }),
              el('span', { className: 'bap-hint' }, '用播放器看副歌从第几秒开始')),
            el(Row, { key: 'dur', label: '播多久（秒）' },
              el('input', { className: 'bap-num', type: 'number', min: 0, step: 0.5, value: sec(cfg.sfxDurationMs), onChange: function (e) { set({ sfxDurationMs: Math.round(num(e.target.value) * 1000) }) } }),
              el('span', { className: 'bap-hint' }, '0 = 跟开屏一起结束'))));

          var swatches = ['#f2d79a', '#ffffff', '#e0574a', '#6fd8d0', '#b79bff', '#7fb2ff'].map(function (c2) {
            return el('button', { key: 'sw' + c2, className: 'bap-swatch', style: { background: c2 }, title: c2, onClick: function () { set({ titleColor: c2 }) } });
          });

          var wctLabel = function () {
            if (!wct) return '读取中…';
            if (wct.state === 'patched') return '已应用 ✓ 右上角按钮区已透明（画面完全铺满）';
            if (wct.state === 'clean') return '未应用 · 按钮区仍是官方底色' + (wct.backup ? '（已有备份，可随时还原）' : '');
            if (wct.state === 'anchor-missing') return '当前 DSH 版本不支持（找不到目标代码，脚本会安全跳过）';
            if (wct.state === 'not-found') return '找不到 app.asar，无法操作';
            return '检测异常：' + (wct.hint || '未知');
          };
          var cardWct = el('div', { className: 'bap-card', key: 'card-wct' }, arr(
            el('div', { className: 'bap-h', key: 'h' }, '⑥ 窗口控件透明（进阶）'),
            el('div', { key: 'state', className: (wct && wct.state === 'patched') ? 'bap-ok' : 'bap-hint' }, wctLabel()),
            el('div', { key: 'desc', className: 'bap-hint' }, '把 DSH 窗口右上角按钮区的底色改成透明 —— 开屏动画就能完全铺满，只剩三个窗口按钮图标浮在画面上。这是唯一能覆盖那块区域的办法（它由 DSH 主进程绘制，网页层盖不住）。'),
            el('div', { key: 'how', className: 'bap-hint' }, '用法：点「应用并重启」→ 再点一次确认 → 完全退出 DSH → 脚本自动打补丁并重新启动它（约 10 秒）。DSH 自动更新后补丁会被覆盖，回到这里再点一次即可。'),
            el('div', { key: 'btns', className: 'bap-actions' },
              el('button', { className: 'bap-btn primary', disabled: busy, onClick: function () { doWct('apply') } }, wctArmed ? '确认应用？再点一次' : '应用并重启'),
              el('button', { className: 'bap-btn', disabled: busy, onClick: function () { doWct('revert') } }, '还原官方'),
              el('button', { className: 'bap-btn', disabled: busy, onClick: loadWct }, '刷新状态')),
            el('div', { key: 'log', className: 'bap-hint' }, wct && wct.log ? '日志：' + wct.log + '　｜　还原脚本：' + (wct.tools || '') + '\\还原开屏补丁.bat' : '')));

          var cardText = el('div', { className: 'bap-card', key: 'card-text' }, arr(
            el('div', { className: 'bap-h', key: 'h' }, '⑤ 落款文字与字体'),
            el(Row, { key: 'title', label: '主标题' },
              el('input', { type: 'text', 'data-field': 'title', value: cfg.title || '', onChange: function (e) { set({ title: e.target.value }) } })),
            el(Row, { key: 'sub', label: '副标题' },
              el('input', { type: 'text', 'data-field': 'subtitle', value: cfg.subtitle || '', onChange: function (e) { set({ subtitle: e.target.value }) } })),
            el(Row, { key: 'font', label: '书法字体' },
              el('select', { value: cfg.titleFont || '华文新魏', onChange: function (e) { set({ titleFont: e.target.value }) } },
                fonts.map(function (f2) { return option(f2.id, f2.label) }))),
            el(Row, { key: 'color', label: '文字颜色' },
              el('input', { type: 'color', value: cfg.titleColor || '#f2d79a', onChange: function (e) { set({ titleColor: e.target.value }) } }),
              swatches,
              el('button', { className: 'bap-btn', onClick: function () { set({ titleColor: '' }) } }, '默认金')),
            el(Row, { key: 'size', label: '主标题字号' },
              el('input', { className: 'bap-num', type: 'number', min: 0, step: 1, value: Number(cfg.titleFontSize) || 0, onChange: function (e) { set({ titleFontSize: Math.round(num(e.target.value)) }) } }),
              el('span', { className: 'bap-hint' }, 'px；0 = 自动（跟随内置样式）')),
            el(Row, { key: 'subsize', label: '副标题字号' },
              el('input', { className: 'bap-num', type: 'number', min: 0, step: 1, value: Number(cfg.subtitleFontSize) || 0, onChange: function (e) { set({ subtitleFontSize: Math.round(num(e.target.value)) }) } }),
              el('span', { className: 'bap-hint' }, 'px；0 = 自动')),
            el('div', { key: 'note', className: 'bap-hint' }, '字体名用的是 Windows 注册名（中文）；选完记得「保存并立即生效」或重启 DSH —— 开屏动画只在这一刻读取配置。')));

          var actions = el('div', { className: 'bap-actions', key: 'actions' }, arr(
            el('button', { key: 'save', className: 'bap-btn primary', disabled: busy, onClick: function () { save(false) } }, '保存'),
            el('button', { key: 'save2', className: 'bap-btn', disabled: busy, onClick: function () { save(true) } }, '保存并立即生效'),
            el('button', { key: 'reload', className: 'bap-btn', disabled: busy, onClick: load }, '重新读取'),
            el('button', { key: 'uninstall', className: 'bap-btn danger', disabled: busy, onClick: doUninstall }, uninstallArmed ? '确认卸载？再点一次' : '卸载插件')));

          return el('div', { className: 'bap' }, arr(
            cardAnim,
            cardMedia,
            cardFlash,
            cardSfx,
            cardText,
            cardWct,
            actions,
            msg ? el('div', { key: 'msg', className: 'bap-msg' }, msg) : null,
            el('div', { key: 'foot', className: 'bap-hint' }, '配置文件：' + (state.configPath || '（见插件目录）') + '（也可直接手改）'),
            el('div', { key: 'ver', className: 'bap-hint' }, '面板版本：v2.0（自定义动画 · 皮肤层 · 闪烁层）· 加载于 ' + new Date().toLocaleString('zh-CN'))));
        }

        var name = 'boot-anim-panel';
        var inject = ['slots'];
        function apply(ctx) {
          try {
            ctx.slots.inject('settings.section', function* () {
              yield ctx.slots.register(
                { name: 'settings.section', id: 'boot-anim', order: 42, label: function () { return '开屏动画' } },
                Panel,
              );
            });
          } catch (error) {
            console.warn('[dsh-boot-anim] 设置面板注册失败：' + (error && error.message));
          }
        }

        module.exports = { apply: apply, inject: inject, name: name };
      } catch (error) {
        console.warn('[dsh-boot-anim] client 装配失败：' + (error && error.message));
        module.exports = { name: 'boot-anim-panel', apply: function () {} };
      }
      return module.exports;
    },
  });
})();
