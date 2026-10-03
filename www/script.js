/* ═══════════════════════════════════════════
   دفترچه من — script.js
   بدون کتابخانه خارجی | localStorage | فارسی RTL
   ═══════════════════════════════════════════ */
(() => {
'use strict';

/* ───────── ابزارهای کمکی ───────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fa = n => Number(n).toLocaleString('fa-IR');
const DAY = 86400000;
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = n => `<span class="material-symbols-rounded">${n}</span>`;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const fmtDate = ts => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(ts);
const pYear = ts => new Intl.DateTimeFormat('fa-IR', { year: 'numeric' }).format(ts);
const dayKey = ts => new Intl.DateTimeFormat('fa-IR', { month: 'numeric', day: 'numeric' }).format(ts);
const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const words = t => (t.trim().match(/\S+/g) || []).length;
const store = {
  get: (k, d) => { try { const v = localStorage.getItem('nb:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('nb:' + k, JSON.stringify(v)); } catch { toast('حافظه مرورگر پر است', 'error'); } }
};

/* ───────── وضعیت برنامه ───────── */
let notes = store.get('notes', []);
let trash = store.get('trash', []);
let folders = store.get('folders', []);                       // [{id,name}]
const savedCfg = store.get('cfg', {});
let cfg = Object.assign({ font: 'Doran', theme: 'dark', themeMode: 'auto', palette: 'aurora', layout: 'grid', pin: '', midnight: true, haptic: true, showPrivate: false }, savedCfg);
if (savedCfg.theme && !savedCfg.themeMode) cfg.themeMode = savedCfg.theme;   // مهاجرت از نسخه قبلی
let freshId = '';
const ui = { filter: 'all', sort: 'newest', q: '', tag: '', folder: '', editing: null, draft: null, color: 'default', pinned: false, priv: false, preview: false };
const save = () => { store.set('notes', notes); store.set('trash', trash); store.set('folders', folders); store.set('cfg', cfg); };
const vibrate = ms => { if (cfg.haptic && navigator.vibrate) navigator.vibrate(ms); };

/* ───────── Toast ───────── */
function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = icon(type === 'error' ? 'error' : 'check_circle') + `<span>${esc(msg)}</span>`;
  $('#toasts').append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 2200);
}

/* ───────── مارک‌داون زنده ───────── */
const TAG_RE = /(^|[\s>])#([\w\u0600-\u06FF]+)/g;
const CB_RE = /^(\s*[-*]?\s*)\[( |x|X)?\]\s?(.*)$/;
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(TAG_RE, '$1<span class="tag" data-tag="$2">#$2</span>');
}
function md(text, interactive) {
  let out = '', inList = false;
  text.split('\n').forEach((line, i) => {
    const cb = line.match(CB_RE);
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if ((cb || li) && !inList) { out += '<ul>'; inList = true; }
    if (!cb && !li && inList) { out += '</ul>'; inList = false; }
    if (cb) {
      const done = /x/i.test(cb[2] || '');
      out += `<li class="cb ${done ? 'done' : ''}" ${interactive ? `data-line="${i}"` : ''} style="list-style:none">${icon(done ? 'check_box' : 'check_box_outline_blank')}<span>${inline(cb[3])}</span></li>`;
    } else if (li) out += `<li>${inline(li[1])}</li>`;
    else if (h) out += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
    else if (line.trim()) out += `<div>${inline(line)}</div>`;
  });
  return out + (inList ? '</ul>' : '');
}
const hasChecklist = n => n.body.split('\n').some(l => CB_RE.test(l));
const tagsOf = n => [...new Set([...(n.title + ' ' + n.body).matchAll(/(?:^|\s)#([\w\u0600-\u06FF]+)/g)].map(m => m[1]))];

/* ───────── فیلتر و مرتب‌سازی ───────── */
function visibleNotes() {
  const now = Date.now(), today = startOfDay(now);
  let list = notes.filter(n => !n.private || cfg.showPrivate);
  if (ui.folder) list = list.filter(n => n.folder === ui.folder);
  if (ui.tag) list = list.filter(n => tagsOf(n).includes(ui.tag));
  if (ui.q) { const q = ui.q.toLowerCase(); list = list.filter(n => (n.title + ' ' + n.body).toLowerCase().includes(q)); }
  if (ui.filter === 'pinned') list = list.filter(n => n.pinned);
  if (ui.filter === 'today') list = list.filter(n => n.updated >= today);
  if (ui.filter === 'week') list = list.filter(n => n.updated >= now - 7 * DAY);
  if (ui.filter === 'checklist') list = list.filter(hasChecklist);
  const sorters = {
    newest: (a, b) => b.updated - a.updated, oldest: (a, b) => a.updated - b.updated,
    alpha: (a, b) => (a.title || '').localeCompare(b.title || '', 'fa'), length: (a, b) => b.body.length - a.body.length
  };
  return list.sort(sorters[ui.sort]);
}
const groupOf = n => {
  const today = startOfDay(Date.now());
  if (n.updated >= today) return 'امروز';
  if (n.updated >= today - DAY) return 'دیروز';
  if (n.updated >= today - 6 * DAY) return 'این هفته';
  return 'قدیمی‌تر';
};

/* ───────── رندر ───────── */
function noteCard(n, i) {
  const el = document.createElement('article');
  el.className = 'note' + (n.pinned ? ' pinned' : '') + (n.private ? ' private' : '');
  el.dataset.id = n.id; el.dataset.color = n.color; el.tabIndex = 0;
  el.style.setProperty('--i', Math.min(i, 14));
  el.setAttribute('aria-label', n.title || 'بدون عنوان');
  const full = n.title + ' ' + n.body;
  el.innerHTML = `
    <div class="note-head"><h3 class="note-title">${esc(n.title || 'بدون عنوان')}</h3>${n.pinned ? icon('push_pin').replace('class="', 'class="note-pin ') : ''}</div>
    <div class="note-body">${md(n.body, true)}</div>
    <div class="note-foot">
      <span>${fmtDate(n.updated)}</span><span>${fa(full.length)} کاراکتر · ${fa(words(full))} کلمه</span>
      <div class="note-actions">
        <button type="button" class="icon-btn sm" data-act="pin" aria-label="پین">${icon('push_pin')}</button>
        <button type="button" class="icon-btn sm" data-act="edit" aria-label="ویرایش">${icon('edit')}</button>
        <button type="button" class="icon-btn sm" data-act="del" aria-label="حذف">${icon('delete')}</button>
      </div>
    </div>`;
  return el;
}
function render(anim = false) {
  const box = $('#notesContainer'), list = visibleNotes();
  box.className = 'notes ' + cfg.layout;
  box.innerHTML = '';
  const dated = ui.sort === 'newest' || ui.sort === 'oldest';
  let last = '', i = 0;
  list.sort((a, b) => b.pinned - a.pinned);
  list.forEach(n => {
    const g = n.pinned ? 'پین‌شده' : dated ? groupOf(n) : '';
    if (g && g !== last) { const t = document.createElement('div'); t.className = 'group-title'; t.textContent = g; box.append(t); }
    last = g; const c = noteCard(n, i++); if (!anim && n.id !== freshId) c.classList.add('no-anim'); box.append(c);
  });
  $('#emptyState').hidden = list.length > 0;
  const shown = notes.filter(n => !n.private || cfg.showPrivate);
  $('#statTotal').textContent = fa(shown.length);
  $('#statPinned').textContent = fa(shown.filter(n => n.pinned).length);
  $('#statWords').textContent = fa(shown.reduce((s, n) => s + words(n.title + ' ' + n.body), 0));
  $('#layoutBtn span').textContent = cfg.layout === 'grid' ? 'view_list' : 'grid_view';
  $('#trashBadge').hidden = !trash.length; $('#trashBadge').textContent = fa(trash.length);
  renderSide(shown); renderOTD(shown);
}
function renderSide(shown) {
  const fl = $('#folderList');
  const row = (id, name, cnt, ic) => `<li data-folder="${id}" class="${ui.folder === id ? 'active' : ''}" tabindex="0">${icon(ic)}<span>${esc(name)}</span><small>${fa(cnt)}</small>${id ? `<button type="button" class="icon-btn sm f-del" data-delfolder="${id}" aria-label="حذف پوشه">${icon('close')}</button>` : ''}</li>`;
  fl.innerHTML = row('', 'همه یادداشت‌ها', shown.length, 'folder_open') +
    folders.map(f => row(f.id, f.name, shown.filter(n => n.folder === f.id).length, 'folder')).join('');
  const counts = {};
  shown.forEach(n => tagsOf(n).forEach(t => counts[t] = (counts[t] || 0) + 1));
  const tg = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  $('#tagCloud').innerHTML = tg.length ? tg.map(([t, c]) => `<span class="tag ${ui.tag === t ? 'active' : ''}" data-tag="${t}" style="font-size:${0.8 + Math.min(c, 6) * 0.06}rem">#${t}</span>`).join('') : '<small class="muted">هنوز برچسبی نیست؛ #هشتگ بنویس</small>';
}
function renderOTD(shown) {
  const k = dayKey(Date.now()), y = pYear(Date.now()), t0 = startOfDay(Date.now());
  const list = shown.filter(n => n.created < t0 && dayKey(n.created) === k && pYear(n.created) !== y);
  $('#onThisDay').hidden = !list.length;
  $('#otdList').innerHTML = list.map(n => `<span class="tag" data-open="${n.id}">${esc(n.title || 'بدون عنوان')}</span>`).join('');
}

/* ───────── ویرایشگر ───────── */
const ov = id => $('#' + id);
function openOverlay(id) { ov(id).hidden = false; }
function closeOverlay(id) { ov(id).hidden = true; if (id === 'editorOverlay') { document.body.classList.remove('zen'); $('#zenExit').hidden = true; stopVoice(); window.speechSynthesis && speechSynthesis.cancel(); } }
function fillFolderSelect() {
  $('#edFolder').innerHTML = '<option value="">بدون پوشه</option>' + folders.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
}
function openEditor(id, preset) {
  const n = id ? notes.find(x => x.id === id) : null;
  ui.editing = id || null; ui.snap = n ? JSON.stringify(n) : null;
  fillFolderSelect();
  $('#editorTitleLabel').textContent = n ? 'ویرایش یادداشت' : 'یادداشت جدید';
  $('#edTitle').value = n ? n.title : (preset?.title || '');
  $('#edBody').value = n ? n.body : (preset?.body || '');
  $('#edFolder').value = n ? n.folder || '' : ui.folder;
  setColor(n ? n.color : 'default'); setPin(n ? n.pinned : false); setPriv(n ? n.private : false);
  $('#edDelete').hidden = !n; setPreview(false); updateCounter();
  openOverlay('editorOverlay');
  setTimeout(() => (n ? $('#edBody') : $('#edTitle')).focus(), 50);
}
const setColor = c => { ui.color = c; $$('#colorPicker .dot').forEach(d => d.classList.toggle('active', d.dataset.color === c)); };
const setPin = p => { ui.pinned = p; $('#edPin').classList.toggle('on', p); };
const setPriv = p => { ui.priv = p; $('#edPrivate span').textContent = p ? 'lock' : 'lock_open'; $('#edPrivate').classList.toggle('on', p); };
function setPreview(on) {
  ui.preview = on; $('#mdPreview').hidden = !on; $('#edBody').hidden = on;
  $('#mdPreviewBtn').setAttribute('aria-pressed', on);
  if (on) $('#mdPreview').innerHTML = md($('#edBody').value, false);
}
function updateCounter() {
  const t = $('#edTitle').value + ' ' + $('#edBody').value;
  $('#edCounter').textContent = `${fa(t.trim().length)} کاراکتر · ${fa(words(t))} کلمه`;
}
function readEditor() {
  return { title: $('#edTitle').value.trim(), body: $('#edBody').value, color: ui.color, pinned: ui.pinned, private: ui.priv, folder: $('#edFolder').value };
}
function saveEditor(close = true) {
  const d = readEditor();
  if (!d.title && !d.body.trim()) { if (close) closeOverlay('editorOverlay'); return; }
  if (d.private && !cfg.pin) { toast('برای یادداشت خصوصی ابتدا قفل PIN را فعال کن', 'error'); d.private = false; setPriv(false); }
  const now = Date.now();
  if (ui.editing) Object.assign(notes.find(x => x.id === ui.editing), d, { updated: now });
  else { const n = { id: uid(), created: now, updated: now, ...d }; notes.unshift(n); ui.editing = n.id; freshId = n.id; if (close) confetti(); }
  save(); render(); freshId = ''; vibrate(15);
  if (close) { closeOverlay('editorOverlay'); toast(d.private && !cfg.showPrivate ? 'ذخیره شد (یادداشت خصوصی مخفی است)' : 'ذخیره شد'); }
}
const autosave = debounce(() => { if (ui.editing && !$('#editorOverlay').hidden) saveEditor(false); }, 800);   // ذخیره خودکار

function confirmBox(text) {
  return new Promise(res => {
    $('#confirmText').textContent = text; openOverlay('confirmOverlay'); $('#confirmNo').focus();
    const done = v => { closeOverlay('confirmOverlay'); $('#confirmYes').onclick = $('#confirmNo').onclick = null; res(v); };
    $('#confirmYes').onclick = () => done(true); $('#confirmNo').onclick = () => done(false);
  });
}
async function removeNote(id, fromEditor) {
  if (!(await confirmBox('این یادداشت حذف شود؟'))) return;
  const n = notes.find(x => x.id === id); if (!n) return;
  const card = $(`.note[data-id="${id}"]`);
  if (fromEditor) closeOverlay('editorOverlay');
  card && card.classList.add('removing');
  setTimeout(() => { notes = notes.filter(x => x.id !== id); trash.unshift({ ...n, deletedAt: Date.now() }); save(); render(); toast('حذف شد'); vibrate(30); }, card ? 380 : 0);
}
function togglePin(id) { const n = notes.find(x => x.id === id); n.pinned = !n.pinned; save(); render(); vibrate(10); }
function toggleCheck(id, line) {
  const n = notes.find(x => x.id === id), ls = n.body.split('\n');
  ls[line] = ls[line].replace(/\[( |x|X)?\]/, (m, c) => (/x/i.test(c || '') ? '[ ]' : '[x]'));
  n.body = ls.join('\n'); n.updated = Date.now(); save(); render(); vibrate(8);
}

/* دکمه‌های نوار مارک‌داون */
function mdApply(kind) {
  const t = $('#edBody'), s = t.selectionStart, e = t.selectionEnd, sel = t.value.slice(s, e);
  const wrap = (a, b) => t.setRangeText(a + (sel || 'متن') + b, s, e, 'select');
  const line = p => t.setRangeText(p + sel, s, e, 'end');
  ({ b: () => wrap('**', '**'), s: () => wrap('~~', '~~'), hl: () => wrap('==', '=='), h: () => line('# '), ul: () => line('- '), cb: () => line('- [ ] '), tag: () => line('#') }[kind] || (() => { }))();
  t.focus(); updateCounter(); autosave();
}

/* ───────── ورودی صوتی و خواندن با صدا ───────── */
let rec = null;
function stopVoice() { if (rec) { rec.stop(); rec = null; $('#edVoice span').textContent = 'mic'; $('#edVoice').classList.remove('on'); } }
function toggleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('مرورگر شما از ورودی صوتی پشتیبانی نمی‌کند', 'error');
  if (rec) return stopVoice();
  rec = new SR(); rec.lang = 'fa-IR'; rec.continuous = true; rec.interimResults = false;
  rec.onresult = e => { const t = [...e.results].slice(e.resultIndex).map(r => r[0].transcript).join(' '); $('#edBody').value += (($('#edBody').value && !/\s$/.test($('#edBody').value)) ? ' ' : '') + t; updateCounter(); };
  rec.onend = () => { if (rec) stopVoice(); };
  rec.onerror = () => { toast('خطا در تشخیص صدا', 'error'); stopVoice(); };
  rec.start(); $('#edVoice span').textContent = 'mic_off'; $('#edVoice').classList.add('on');
}
function toggleSpeak() {
  if (!('speechSynthesis' in window)) return toast('خواندن با صدا پشتیبانی نمی‌شود', 'error');
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); $('#edSpeak span').textContent = 'volume_up'; return; }
  const u = new SpeechSynthesisUtterance($('#edTitle').value + '. ' + $('#edBody').value); u.lang = 'fa-IR';
  u.onend = () => { $('#edSpeak span').textContent = 'volume_up'; };
  speechSynthesis.speak(u); $('#edSpeak span').textContent = 'volume_off';
}
async function copyNote() {
  const t = $('#edTitle').value + '\n\n' + $('#edBody').value;
  try { await navigator.clipboard.writeText(t); toast('کپی شد'); } catch { toast('کپی ممکن نیست', 'error'); }
}

/* ───────── قالب‌ها ───────── */
const TEMPLATES = [
  { n: 'لیست خرید', i: 'shopping_cart', title: 'لیست خرید', body: '- [ ] نان\n- [ ] شیر\n- [ ] میوه\n- [ ] ' },
  { n: 'ایده', i: 'lightbulb', title: 'ایده جدید', body: '## ایده\n\n## چرا مهم است؟\n\n## قدم اول\n- [ ] \n\n#ایده' },
  { n: 'تسک', i: 'task_alt', title: 'کارهای امروز', body: '## مهم\n- [ ] \n\n## معمولی\n- [ ] \n\n#تسک' },
  { n: 'جلسه', i: 'groups', title: 'صورت‌جلسه', body: `## موضوع\n\n## حاضران\n\n## تصمیم‌ها\n- \n\n## اقدام بعدی\n- [ ] \n\n#جلسه` }
];
function renderTemplates() {
  $('#tplGrid').innerHTML = TEMPLATES.map((t, i) => `<button type="button" class="tpl" data-tpl="${i}">${icon(t.i)}<span>${t.n}</span></button>`).join('');
}

/* ───────── سطل زباله ───────── */
function purgeTrash() { const lim = Date.now() - 30 * DAY; trash = trash.filter(n => n.deletedAt > lim); }
function renderTrash() {
  $('#trashList').innerHTML = trash.length ? trash.map(n => `<li data-id="${n.id}"><span>${esc(n.title || 'بدون عنوان')}</span><button type="button" class="btn ghost" data-act="restore">${icon('undo')}بازیابی</button><button type="button" class="icon-btn sm" data-act="purge" aria-label="حذف همیشگی">${icon('delete_forever')}</button></li>`).join('') : '<li class="muted">سطل خالی است</li>';
}

/* ───────── داشبورد ───────── */
function renderDash() {
  const bars = (title, rows) => { const m = Math.max(1, ...rows.map(r => r[1])); return `<h3>${title}</h3>` + rows.map(([l, v]) => `<div class="bar-row"><span>${l}</span><div class="bar"><i style="width:${v / m * 100}%"></i></div><b>${fa(v)}</b></div>`).join(''); };
  const names = { default: 'پیش‌فرض', purple: 'بنفش', cyan: 'فیروزه‌ای', pink: 'صورتی', gold: 'طلایی', green: 'سبز' };
  const days = [...Array(7)].map((_, i) => { const s = startOfDay(Date.now() - (6 - i) * DAY); return [new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(s), notes.filter(n => n.created >= s && n.created < s + DAY).length]; });
  $('#dashBody').innerHTML = bars('یادداشت‌های ۷ روز اخیر', days) +
    bars('بر اساس رنگ', Object.keys(names).map(c => [names[c], notes.filter(n => n.color === c).length])) +
    (folders.length ? bars('بر اساس پوشه', folders.map(f => [esc(f.name), notes.filter(n => n.folder === f.id).length])) : '');
}

/* ───────── پشتیبان‌گیری ───────── */
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const exportable = () => notes.filter(n => !n.private);
function exportText(kind) {
  const s = exportable().map(n => kind === 'md' ? `# ${n.title}\n\n${n.body}\n\n---\n` : `${n.title}\n${fmtDate(n.updated)}\n\n${n.body}\n\n==========\n`).join('\n');
  download(`notebook.${kind}`, s, 'text/plain;charset=utf-8'); toast('ذخیره شد');
}
function importJson(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result); if (!Array.isArray(d.notes)) throw 0;
      const ids = new Set(notes.map(n => n.id));
      d.notes.forEach(n => { if (n && typeof n.body === 'string' && !ids.has(n.id)) notes.push({ id: n.id || uid(), title: n.title || '', body: n.body, color: n.color || 'default', pinned: !!n.pinned, private: false, folder: n.folder || '', created: n.created || Date.now(), updated: n.updated || Date.now() }); });
      (d.folders || []).forEach(f => { if (!folders.some(x => x.id === f.id)) folders.push(f); });
      save(); render(); toast('ذخیره شد');
    } catch { toast('فایل معتبر نیست', 'error'); }
  };
  r.readAsText(file);
}

/* ───────── PIN ───────── */
const hashPin = p => btoa('nb-salt-' + p);
let pinBuf = '';
function showLock() { $('#lockScreen').hidden = false; pinBuf = ''; drawDots(); }
function drawDots() { $$('#pinDots i').forEach((d, i) => d.classList.toggle('on', i < pinBuf.length)); }
function pinKey(k) {
  if (k === 'back') pinBuf = pinBuf.slice(0, -1); else if (pinBuf.length < 4) pinBuf += k;
  drawDots(); vibrate(8);
  if (pinBuf.length === 4) {
    if (hashPin(pinBuf) === cfg.pin) { $('#lockScreen').hidden = true; }
    else { const d = $('#pinDots'); d.classList.add('shake'); vibrate([40, 40, 40]); setTimeout(() => { d.classList.remove('shake'); pinBuf = ''; drawDots(); }, 450); }
  }
}

/* ───────── فونت، تم، پالت ───────── */
function applyFont(f) {
  cfg.font = f; document.documentElement.style.setProperty('--font-active', `'${f}'`);
  $$('#fontMenu li').forEach(li => { const on = li.dataset.font === f; li.classList.toggle('selected', on); li.setAttribute('aria-selected', on); });
  save();
}
const mq = matchMedia('(prefers-color-scheme: light)');
const effTheme = () => cfg.themeMode === 'auto' ? (mq.matches ? 'light' : 'dark') : cfg.themeMode;
function applyTheme(mode, animate = true) {
  if (mode) cfg.themeMode = mode;                                   // auto | light | dark
  const t = effTheme(), root = document.documentElement;
  if (animate) { root.classList.add('theming'); setTimeout(() => root.classList.remove('theming'), 600); }
  cfg.theme = t; root.dataset.theme = t;
  $('#themeBtn span').textContent = t === 'dark' ? 'light_mode' : 'dark_mode';
  $('#themeBtn').setAttribute('aria-label', t === 'dark' ? 'تغییر به تم روشن' : 'تغییر به تم تاریک');
  const m = $('meta[name="theme-color"]'); if (m) m.content = t === 'dark' ? '#08080d' : '#f4f3fb';
  $('#themeSelect').value = cfg.themeMode; save();
}
const toggleTheme = () => applyTheme(effTheme() === 'dark' ? 'light' : 'dark');
mq.addEventListener && mq.addEventListener('change', () => { if (cfg.themeMode === 'auto') applyTheme(null); });
function applyPalette(p) { cfg.palette = p; document.documentElement.dataset.palette = p; save(); }
function checkMidnight() { const h = new Date().getHours(); document.body.classList.toggle('midnight', cfg.midnight && h >= 0 && h < 5); }
function enterZen() { if ($('#editorOverlay').hidden) openEditor(); document.body.classList.add('zen'); $('#zenExit').hidden = false; $('#edBody').focus(); }
function exitZen() { document.body.classList.remove('zen'); $('#zenExit').hidden = true; }

/* ───────── پالت دستورات ───────── */
let cmdSel = 0, cmdItems = [];
const COMMANDS = () => [
  { t: 'یادداشت جدید', i: 'add', k: 'Ctrl+N', run: () => openEditor() },
  { t: 'قالب‌های آماده', i: 'auto_awesome', run: () => { renderTemplates(); openOverlay('tplOverlay'); } },
  { t: 'تغییر تم روشن/تاریک', i: 'dark_mode', run: toggleTheme },
  { t: 'تغییر چیدمان', i: 'view_list', run: () => { cfg.layout = cfg.layout === 'grid' ? 'list' : 'grid'; save(); render(); } },
  { t: 'حالت تمرکز', i: 'center_focus_strong', run: enterZen },
  { t: 'پوشه جدید', i: 'create_new_folder', run: newFolder },
  { t: 'سطل زباله', i: 'delete', run: () => { renderTrash(); openOverlay('trashOverlay'); } },
  { t: 'داشبورد', i: 'bar_chart', run: () => { renderDash(); openOverlay('dashOverlay'); } },
  { t: 'تنظیمات', i: 'settings', run: openSettings },
  { t: 'خروجی JSON', i: 'download', run: () => $('#exportJson').click() },
  ...['aurora', 'sunset', 'ocean', 'neon', 'mono'].map(p => ({ t: 'تم رنگی: ' + p, i: 'palette', run: () => applyPalette(p) })),
  ...['Doran', 'Hakaza', 'Irancell', 'Hasti', 'Farhang'].map(f => ({ t: 'فونت: ' + f, i: 'text_fields', run: () => applyFont(f) })),
  ...(cfg.pin ? [{ t: 'قفل کردن دفترچه', i: 'lock', run: showLock }] : [])
];
function drawCmd() {
  const q = $('#cmdInput').value.trim().toLowerCase();
  const cmds = COMMANDS().filter(c => c.t.toLowerCase().includes(q)).map(c => ({ ...c, kind: 'دستور' }));
  const ns = q ? notes.filter(n => (!n.private || cfg.showPrivate) && (n.title + n.body).toLowerCase().includes(q)).slice(0, 6).map(n => ({ t: n.title || 'بدون عنوان', i: 'description', kind: 'یادداشت', run: () => openEditor(n.id) })) : [];
  cmdItems = [...cmds, ...ns]; cmdSel = Math.min(cmdSel, Math.max(0, cmdItems.length - 1));
  $('#cmdList').innerHTML = cmdItems.map((c, i) => `<li role="option" data-i="${i}" class="${i === cmdSel ? 'sel' : ''}">${icon(c.i)}<span>${esc(c.t)}</span><small>${c.k || c.kind}</small></li>`).join('') || '<li class="muted">چیزی پیدا نشد</li>';
}
function openCmd() { $('#cmdInput').value = ''; cmdSel = 0; openOverlay('cmdOverlay'); drawCmd(); $('#cmdInput').focus(); }
function runCmd(i) { const c = cmdItems[i]; if (!c) return; closeOverlay('cmdOverlay'); c.run(); }

async function delFolder(id) {
  if (!(await confirmBox('پوشه حذف شود؟ یادداشت‌های آن حذف نمی‌شوند.'))) return;
  folders = folders.filter(f => f.id !== id); notes.forEach(n => { if (n.folder === id) n.folder = ''; });
  if (ui.folder === id) ui.folder = ''; save(); render(true); toast('حذف شد');
}
function newFolder() {
  const name = (prompt('نام پوشه جدید:') || '').trim(); if (!name) return;
  folders.push({ id: uid(), name }); save(); render(); fillFolderSelect(); toast('ذخیره شد');
}
function openSettings() {
  $('#showPrivate').checked = cfg.showPrivate; $('#midnightToggle').checked = cfg.midnight; $('#hapticToggle').checked = cfg.haptic;
  $('#pinInput').value = ''; openOverlay('settingsOverlay');
}

/* ───────── انیمیشن‌ها ───────── */
// هاله‌ی دنبال‌کننده موس با rAF
const glow = $('#cursorGlow'); let mx = 0, my = 0, gx = 0, gy = 0;
if (matchMedia('(hover:hover)').matches) {
  addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; glow.classList.add('on'); });
  (function loop() { gx += (mx - gx) * .12; gy += (my - gy) * .12; glow.style.transform = `translate(${gx}px,${gy}px)`; requestAnimationFrame(loop); })();
}
// موج روی دکمه‌ها
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.btn,.icon-btn,.fab'); if (!b) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), d = document.createElement('span');
  d.className = 'ripple'; d.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  b.append(d); setTimeout(() => d.remove(), 600);
});
// دکمه‌های مغناطیسی
let magTick = false;
document.addEventListener('mousemove', () => {
  if (magTick) return; magTick = true;
  requestAnimationFrame(() => {
    magTick = false;
    $$('.magnetic').forEach(b => {
      b.style.transform = '';
      const r = b.getBoundingClientRect(), dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < 90) b.style.transform = `translate(${dx * .25}px,${dy * .25}px)`;
    });
  });
});
// کنفتی روی Canvas
function confetti() {
  const cv = $('#confettiCanvas'), ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#a855f7', '#22d3ee', '#f472b6', '#fbbf24', '#34d399'];
  const ps = [...Array(110)].map(() => ({ x: innerWidth / 2, y: innerHeight * .6, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 4, s: 4 + Math.random() * 6, c: cols[Math.random() * 5 | 0], r: Math.random() * 6, l: 1 }));
  (function f() {
    ctx.clearRect(0, 0, cv.width, cv.height); let alive = false;
    ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += .2; p.l -= .011; if (p.l > 0) { alive = true; ctx.save(); ctx.globalAlpha = p.l; ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); ctx.restore(); } });
    alive ? requestAnimationFrame(f) : ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

/* ───────── رویدادها ───────── */
function toggleMenu(btnId, menuId) {
  const b = $(btnId), m = $(menuId), open = m.hidden;
  $$('.dropdown-menu').forEach(x => x.hidden = true); $$('[aria-expanded]').forEach(x => x.setAttribute('aria-expanded', 'false'));
  m.hidden = !open; b.setAttribute('aria-expanded', open);
}
function bind() {
  $('#fontBtn').onclick = e => { e.stopPropagation(); toggleMenu('#fontBtn', '#fontMenu'); };
  $('#paletteBtn').onclick = e => { e.stopPropagation(); toggleMenu('#paletteBtn', '#paletteMenu'); };
  document.addEventListener('click', () => { $$('.dropdown-menu').forEach(x => x.hidden = true); $$('[aria-expanded]').forEach(x => x.setAttribute('aria-expanded', 'false')); });
  $('#fontMenu').onclick = e => { const li = e.target.closest('li'); if (li) applyFont(li.dataset.font); };
  $('#paletteMenu').onclick = e => { const li = e.target.closest('li'); if (li) applyPalette(li.dataset.palette); };
  $$('.dropdown-menu').forEach(m => m.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.click(); } }));

  $('#themeBtn').onclick = toggleTheme;
  $('#themeSelect').onchange = e => applyTheme(e.target.value);
  $('#layoutBtn').onclick = () => { cfg.layout = cfg.layout === 'grid' ? 'list' : 'grid'; save(); render(); };
  $('#cmdBtn').onclick = openCmd;
  $('#dashBtn').onclick = () => { renderDash(); openOverlay('dashOverlay'); };
  $('#trashBtn').onclick = () => { renderTrash(); openOverlay('trashOverlay'); };
  $('#settingsBtn').onclick = openSettings;
  $('#templatesBtn').onclick = () => { renderTemplates(); openOverlay('tplOverlay'); };
  $('#fab').onclick = () => openEditor();
  $('#addFolderBtn').onclick = newFolder;
  document.addEventListener('click', e => { if (e.target.closest('[data-action="new"]')) openEditor(); const c = e.target.closest('[data-close]'); if (c) closeOverlay(c.dataset.close); });

  /* جستجو با debounce ۲۰۰ms */
  const doSearch = debounce(() => { ui.q = $('#searchInput').value.trim(); render(true); }, 200);
  $('#searchInput').oninput = () => { $('#searchClear').hidden = !$('#searchInput').value; doSearch(); };
  $('#searchClear').onclick = () => { $('#searchInput').value = ''; ui.q = ''; $('#searchClear').hidden = true; render(true); };
  $('#quickFilters').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; ui.filter = c.dataset.filter; $$('.chip').forEach(x => x.classList.toggle('active', x === c)); render(true); };
  $('#sortSelect').onchange = e => { ui.sort = e.target.value; render(true); };

  /* کارت‌ها و سایدبار (واگذاری رویداد) */
  document.addEventListener('click', e => {
    const tag = e.target.closest('[data-tag]'); if (tag) { e.stopPropagation(); ui.tag = ui.tag === tag.dataset.tag ? '' : tag.dataset.tag; render(true); return; }
    const otd = e.target.closest('[data-open]'); if (otd) return openEditor(otd.dataset.open);
    const df = e.target.closest('[data-delfolder]'); if (df) { e.stopPropagation(); delFolder(df.dataset.delfolder); return; }
    const fo = e.target.closest('[data-folder]'); if (fo) { ui.folder = fo.dataset.folder; render(true); return; }
    const card = e.target.closest('.note'); if (!card) return;
    const id = card.dataset.id, act = e.target.closest('[data-act]'), cb = e.target.closest('.cb[data-line]');
    if (act) { e.stopPropagation(); act.dataset.act === 'pin' ? togglePin(id) : act.dataset.act === 'edit' ? openEditor(id) : removeNote(id); }
    else if (cb) toggleCheck(id, +cb.dataset.line);
    else openEditor(id);
  });
  $('#notesContainer').addEventListener('keydown', e => { const c = e.target.closest('.note'); if (c && e.target === c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openEditor(c.dataset.id); } });

  /* ویرایشگر */
  $('#edSave').onclick = () => saveEditor(true);
  $('#edCancel').onclick = () => { if (ui.editing && ui.snap) { const i = notes.findIndex(x => x.id === ui.editing); if (i > -1) { notes[i] = JSON.parse(ui.snap); save(); render(); } } closeOverlay('editorOverlay'); };
  $('#edClose').onclick = () => saveEditor(true);
  $('#edDelete').onclick = () => ui.editing && removeNote(ui.editing, true);
  $('#edPin').onclick = () => { setPin(!ui.pinned); autosave(); };
  $('#edPrivate').onclick = () => { if (!cfg.pin) return toast('برای یادداشت خصوصی ابتدا قفل PIN را فعال کن', 'error'); setPriv(!ui.priv); autosave(); };
  $('#edVoice').onclick = toggleVoice; $('#edSpeak').onclick = toggleSpeak; $('#edCopy').onclick = copyNote; $('#edZen').onclick = enterZen;
  $('#zenExit').onclick = exitZen;
  $('#colorPicker').onclick = e => { const d = e.target.closest('.dot'); if (d) { setColor(d.dataset.color); autosave(); } };
  $('#edFolder').onchange = autosave;
  ['#edTitle', '#edBody'].forEach(s => $(s).addEventListener('input', () => { updateCounter(); autosave(); }));
  $('#mdBar').onclick = e => { const b = e.target.closest('[data-md]'); if (!b) return; b.dataset.md === 'preview' ? setPreview(!ui.preview) : (ui.preview || mdApply(b.dataset.md)); };
  $('#editorOverlay').addEventListener('mousedown', e => { if (e.target.id === 'editorOverlay') saveEditor(true); });

  /* قالب‌ها / سطل زباله */
  $('#tplGrid').onclick = e => { const b = e.target.closest('[data-tpl]'); if (!b) return; const t = TEMPLATES[b.dataset.tpl]; closeOverlay('tplOverlay'); openEditor(null, t); };
  $('#trashList').onclick = e => {
    const li = e.target.closest('li[data-id]'), a = e.target.closest('[data-act]'); if (!li || !a) return;
    const i = trash.findIndex(n => n.id === li.dataset.id), n = trash[i];
    if (a.dataset.act === 'restore') { delete n.deletedAt; notes.unshift(n); toast('بازیابی شد'); }
    trash.splice(i, 1); save(); render(); renderTrash();
  };
  $('#trashEmpty').onclick = async () => { if (trash.length && await confirmBox('سطل زباله برای همیشه خالی شود؟')) { trash = []; save(); render(); renderTrash(); toast('حذف شد'); } };

  /* تنظیمات */
  $('#pinSave').onclick = () => { const p = $('#pinInput').value; if (!/^\d{4}$/.test(p)) return toast('رمز باید ۴ رقم باشد', 'error'); cfg.pin = hashPin(p); save(); $('#pinInput').value = ''; toast('ذخیره شد'); };
  $('#pinRemove').onclick = async () => { if (!cfg.pin) return; if (!(await confirmBox('قفل حذف شود؟ یادداشت‌های خصوصی عادی می‌شوند.'))) return; cfg.pin = ''; cfg.showPrivate = false; notes.forEach(n => n.private = false); save(); render(); toast('حذف شد'); };
  $('#showPrivate').onchange = e => { cfg.showPrivate = e.target.checked; save(); render(); };
  $('#midnightToggle').onchange = e => { cfg.midnight = e.target.checked; save(); checkMidnight(); };
  $('#hapticToggle').onchange = e => { cfg.haptic = e.target.checked; save(); };
  $('#exportJson').onclick = () => { download('notebook.json', JSON.stringify({ notes: exportable(), folders }, null, 2), 'application/json'); toast('ذخیره شد'); };
  $('#exportMd').onclick = () => exportText('md'); $('#exportTxt').onclick = () => exportText('txt');
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; };
  $('#printBtn').onclick = () => { closeOverlay('settingsOverlay'); setTimeout(print, 200); };
  $('#pinPad').onclick = e => { const b = e.target.closest('[data-k]'); if (b) pinKey(b.dataset.k); };

  /* پالت دستورات */
  $('#cmdInput').oninput = () => { cmdSel = 0; drawCmd(); };
  $('#cmdInput').onkeydown = e => {
    if (e.key === 'ArrowDown') { cmdSel = (cmdSel + 1) % cmdItems.length; drawCmd(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { cmdSel = (cmdSel - 1 + cmdItems.length) % cmdItems.length; drawCmd(); e.preventDefault(); }
    else if (e.key === 'Enter') runCmd(cmdSel);
  };
  $('#cmdList').onclick = e => { const li = e.target.closest('li[data-i]'); if (li) runCmd(+li.dataset.i); };
  $('#cmdOverlay').addEventListener('mousedown', e => { if (e.target.id === 'cmdOverlay') closeOverlay('cmdOverlay'); });

  /* میان‌برها */
  addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey, c = e.code, typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!$('#lockScreen').hidden) { const m = c.match(/^(?:Digit|Numpad)(\d)$/); if (m) pinKey(m[1]); else if (c === 'Backspace') pinKey('back'); return; }
    if (mod && c === 'KeyK') { e.preventDefault(); openCmd(); }
    else if ((mod || e.altKey) && c === 'KeyN') { e.preventDefault(); openEditor(); }
    else if (mod && c === 'KeyS') { e.preventDefault(); if (!$('#editorOverlay').hidden) { saveEditor(false); toast('ذخیره شد'); } }
    else if (mod && c === 'KeyF') { e.preventDefault(); $('#searchInput').focus(); }
    else if (!mod && !typing && (c === 'Slash' || e.key === '/')) { e.preventDefault(); $('#searchInput').focus(); }
    else if (e.key === 'Escape') {
      if (document.body.classList.contains('zen')) return exitZen();
      const open = $$('.overlay').filter(o => !o.hidden).pop();
      if (open) open.id === 'editorOverlay' ? saveEditor(true) : open.id === 'confirmOverlay' ? $('#confirmNo').click() : closeOverlay(open.id);
      else if (typing) document.activeElement.blur();
    }
  });
}

/* ───────── راه‌اندازی ───────── */
function init() {
  purgeTrash();
  applyFont(cfg.font); applyTheme(null, false); applyPalette(cfg.palette); checkMidnight();
  setInterval(checkMidnight, 60000);
  bind(); render(true);
  if (cfg.pin) showLock();
  setTimeout(() => { const s = $('#skeleton'); s.classList.add('done'); setTimeout(() => s.remove(), 500); }, 450);
}
init();
})();
