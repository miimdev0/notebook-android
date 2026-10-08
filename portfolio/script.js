/* ═══════════════════════════════════════════
   Portfolio — script.js
   i18n (FA/EN) · theme · project grid · counters
   No external libraries.
   ═══════════════════════════════════════════ */

const I18N = {
  fa: {
    nav_about: 'درباره من', nav_projects: 'پروژه‌ها', nav_clients: 'مشتری‌ها', nav_contact: 'تماس',
    about_label: 'درباره من', hello: 'سلام، من', name: 'نام شما',
    role: 'طراح گرافیک و توسعه‌دهنده وب',
    hero_title: 'پورتفولیو',
    hero_lead: 'ایده را به تجربه‌ای بصری تبدیل می‌کنم؛ از هویت برند تا وب‌سایت و موشن.',
    chip1: 'برندینگ', chip2: 'UI/UX', chip3: 'موشن',
    feature_label: 'ریل نمایشی ۲۰۲۶',
    stat_projects: 'پروژه', stat_awards: 'جایزه', stat_awards2: 'جایزه‌ی طراحی بین‌المللی',
    clients_label: 'مشتری‌ها',
    projects_title: 'پروژه‌های منتخب',
    filter_all: 'همه', filter_brand: 'برندینگ', filter_web: 'وب', filter_motion: 'موشن',
    cta_title: 'بیایید یک پروژه بسازیم',
    cta_text: 'برای همکاری یا پرسش، همین حالا پیام بده.',
    cta_btn: 'ارسال ایمیل',
    footer: '© ۲۰۲۶ · ساخته‌شده با دقت',
    lang_btn: 'EN',
  },
  en: {
    nav_about: 'About', nav_projects: 'Projects', nav_clients: 'Clients', nav_contact: 'Contact',
    about_label: 'About Me', hello: "Hi, I'm", name: 'Your Name',
    role: 'Graphic Designer & Web Developer',
    hero_title: 'Visual Poetry',
    hero_lead: 'I turn ideas into visual experiences, from brand identity to websites and motion.',
    chip1: 'Branding', chip2: 'UI/UX', chip3: 'Motion',
    feature_label: 'Showreel 2026',
    stat_projects: 'Projects', stat_awards: 'Awards', stat_awards2: 'Global Design Awards',
    clients_label: 'Clients',
    projects_title: 'Selected Work',
    filter_all: 'All', filter_brand: 'Branding', filter_web: 'Web', filter_motion: 'Motion',
    cta_title: "Let's build something",
    cta_text: 'Got a project or a question? Send me a message.',
    cta_btn: 'Send an email',
    footer: '© 2026 · Crafted with care',
    lang_btn: 'فا',
  },
};

// Placeholder projects — replace with your own
const PROJECTS = [
  { id: 1, cat: 'brand', year: '2026', c1: '#f9d4c4', c2: '#f29e8e', c3: '#fff1e6',
    title: { fa: 'هویت بصری کافه ماه', en: 'Moon Café Identity' },
    catName: { fa: 'برندینگ', en: 'Branding' } },
  { id: 2, cat: 'web', year: '2025', c1: '#c9ece3', c2: '#7fc8b5', c3: '#e8fff8',
    title: { fa: 'وب‌سایت فروشگاه سبز', en: 'Green Store Website' },
    catName: { fa: 'وب', en: 'Web' } },
  { id: 3, cat: 'motion', year: '2025', c1: '#ddd6ff', c2: '#9b8cf0', c3: '#f4f0ff',
    title: { fa: 'موشن تبلیغاتی آتلس', en: 'Atlas Promo Motion' },
    catName: { fa: 'موشن', en: 'Motion' } },
  { id: 4, cat: 'brand', year: '2025', c1: '#ffe9a8', c2: '#fbc85c', c3: '#fff8e1',
    title: { fa: 'پوستر جشنواره‌ی تجسمی', en: 'Visual Arts Festival Poster' },
    catName: { fa: 'برندینگ', en: 'Branding' } },
  { id: 5, cat: 'web', year: '2024', c1: '#cde3ff', c2: '#6fa8ec', c3: '#eef6ff',
    title: { fa: 'اپلیکیشن سلامت لومن', en: 'Lumen Health App' },
    catName: { fa: 'وب', en: 'Web' } },
  { id: 6, cat: 'motion', year: '2024', c1: '#ffd6e8', c2: '#ef87b9', c3: '#fff0f7',
    title: { fa: 'ریل معرفی استودیو', en: 'Studio Intro Reel' },
    catName: { fa: 'موشن', en: 'Motion' } },
];

const state = {
  lang: localStorage.getItem('pf-lang') || document.documentElement.lang || 'fa',
  theme: localStorage.getItem('pf-theme') || 'light',
  filter: 'all',
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ── i18n ── */
function applyLang(lang) {
  state.lang = lang;
  const dict = I18N[lang];
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'fa' ? 'rtl' : 'ltr';
  $$('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key] !== undefined) el.textContent = dict[key];
  });
  $('#langBtn').textContent = dict.lang_btn;
  $('#langBtn').setAttribute('aria-label', lang === 'fa' ? 'Switch to English' : 'تغییر به فارسی');
  $('.name').textContent = dict.name;
  renderFilters();
  renderProjects();
  localStorage.setItem('pf-lang', lang);
}

/* ── Theme ── */
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#050507' : '#e9e9ea';
  localStorage.setItem('pf-theme', theme);
}

/* ── Filters & projects ── */
const FILTERS = [
  { id: 'all', key: 'filter_all' },
  { id: 'brand', key: 'filter_brand' },
  { id: 'web', key: 'filter_web' },
  { id: 'motion', key: 'filter_motion' },
];

function renderFilters() {
  const wrap = $('#filters');
  wrap.innerHTML = '';
  FILTERS.forEach((f) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(state.filter === f.id));
    btn.textContent = I18N[state.lang][f.key];
    btn.addEventListener('click', () => {
      state.filter = f.id;
      renderFilters();
      applyFilter();
    });
    wrap.appendChild(btn);
  });
}

function renderProjects() {
  const grid = $('#grid');
  grid.innerHTML = '';
  PROJECTS.forEach((p, i) => {
    const el = document.createElement('article');
    el.className = 'project reveal';
    el.dataset.cat = p.cat;
    el.style.setProperty('--c1', p.c1);
    el.style.setProperty('--c2', p.c2);
    el.style.setProperty('--c3', p.c3);
    el.style.transitionDelay = `${i * 60}ms`;
    el.innerHTML = `
      <div class="thumb" role="img" aria-label="${p.title[state.lang]}"></div>
      <div class="project-meta">
        <div>
          <h3>${p.title[state.lang]}</h3>
          <div class="cat">${p.catName[state.lang]}</div>
        </div>
        <span class="year">${p.year}</span>
      </div>`;
    grid.appendChild(el);
  });
  applyFilter();
  observeReveal();
}

function applyFilter() {
  $$('.project').forEach((el) => {
    el.hidden = state.filter !== 'all' && el.dataset.cat !== state.filter;
  });
}

/* ── Reveal on scroll ── */
let io;
function observeReveal() {
  if (!('IntersectionObserver' in window)) {
    $$('.reveal').forEach((el) => el.classList.add('in'));
    return;
  }
  if (io) io.disconnect();
  io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  $$('.reveal:not(.in)').forEach((el) => io.observe(el));
}

/* ── Counters ── */
function animateCounters() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  $$('.num[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    if (reduce) { el.textContent = target; return; }
    const start = performance.now();
    const dur = 1200;
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(state.theme);
  applyLang(I18N[state.lang] ? state.lang : 'fa');

  $('#langBtn').addEventListener('click', () => {
    applyLang(state.lang === 'fa' ? 'en' : 'fa');
  });
  $('#themeBtn').addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  // Reveal the bento cards with a stagger, then count up the numbers
  $$('.bento > .card').forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${i * 70}ms`;
  });
  observeReveal();
  animateCounters();
});
