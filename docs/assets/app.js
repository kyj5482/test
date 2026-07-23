/* 프레지식 무한 캔버스 SPA — AI · DATA · YOUTH SPORTS.
 *
 * 모든 화면은 거대한 캔버스(#canvas) 위의 '장면(.scene)'이고, 카메라가
 * 줌아웃→비행→줌인으로 이동한다. 트랙(track) = 세로 장면 시퀀스:
 *
 *   홈 트랙(col 0)   : 인트로 → 서비스 ×3 → 이야기 허브 → 뉴스레터      (↓ 스크롤)
 *   서비스 트랙(col 1): 히어로 → 문제 → 기원 → 기능 ×N → 함께하기        (→ 클릭/오른쪽 키)
 *   글 트랙(col 2+)  : 기능이 태어난 이야기 — 같은 무대 위 장면으로 이어짐 (→ 더 깊이)
 *
 * 입력 규칙(모든 장면 동일): ↓/↑ = 서사 이동 · → = 이 장면의 대표 행동(더 깊이)
 * · ← / Esc = 왼쪽(이전 깊이)으로. 우측 대시 레일 호버 = 목차 → 클릭 점프.
 * 언어: 영어 기본(en), 한국어 토글(ko) — 사전은 assets/i18n.js, 사진은 assets/art.js. */

const stage = document.getElementById('stage');
const canvas = document.getElementById('canvas');
const railEl = document.getElementById('rail');
const railDashes = document.getElementById('rail-dashes');
const railPanel = document.getElementById('rail-panel');
const hudLoc = document.getElementById('hud-loc');
const hudHint = document.getElementById('hud-hint');
const backBtn = document.getElementById('nav-back');
const langBtn = document.getElementById('lang-toggle');

let DB = null;

/* ---------- 언어 ---------- */
const LANG_KEY = 'site-lang';
let LANG = localStorage.getItem(LANG_KEY) === 'ko' ? 'ko' : 'en'; // 영어가 기본
const t = (key) => (window.I18N.ui[key] || {})[LANG] || (window.I18N.ui[key] || {}).en || key;

const VER = (window.BUILD_VERSION && !window.BUILD_VERSION.startsWith('__')) ? window.BUILD_VERSION : 'dev';
const withVer = (url) => `${url}${url.includes('?') ? '&' : '?'}v=${VER}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/* ---------- 데이터 접근 (+ 영어 오버레이) ---------- */
const contentOf = (id) => DB.contents.find(c => c.id === id);
const seriesOf = (id) => DB.series.find(s => s.id === id);
const seriesOfContent = (cid) => DB.series.find(s => s.articles.includes(cid));
const productOf = (key) => (DB.products || []).find(p => p.key === key);
const productsOfStory = (cid) => (DB.products || [])
  .map(p => ({ p, feats: (p.features || []).filter(f => (f.stories || []).includes(cid)) }))
  .filter(x => x.feats.length);
const isPlanned = (c) => !!c && c.status === 'planned';

/* 콘텐츠 제목·서비스 문구·시리즈 문구의 현재 언어 버전 */
const cTitle = (c) => (LANG === 'en' && window.I18N.titles[c.id]) || c.title;
const sTr = (s) => {
  const tr = LANG === 'en' && window.I18N.series[s.id];
  return { title: tr ? tr.title : s.title, question: tr ? tr.question : s.question };
};
const pTr = (p) => {
  if (LANG !== 'en') return p;
  const tr = window.I18N.products[p.key];
  if (!tr) return p;
  return {
    ...p,
    tagline: tr.tagline || p.tagline,
    problem: tr.problem || p.problem,
    origin: tr.origin || p.origin,
    forWho: tr.forWho || p.forWho,
    features: p.features.map((f, i) => ({ ...f, ...(tr.features && tr.features[i] || {}) })),
    links: (p.links || []).map(l => ({ ...l, label: (tr.links || {})[l.label.includes('swim.capsule') ? 'swim.capsule' : l.label] || l.label })),
  };
};

const fmtDate = (s) => {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || ''));
  if (!m) return String(s || '');
  return LANG === 'en' ? `${window.I18N.months[+m[2] - 1]} ${+m[3]}, ${m[1]}` : `${m[1]}년 ${+m[2]}월 ${+m[3]}일`;
};
const publishLabel = (c) => (c && c.publish) ? `${t('coming')} · ${fmtDate(c.publish)}` : t('comingSoon');
const coverUrl = (s) => (s && s.hasCover !== false) ? `${s.coverBase}${s.sexed ? '_M' : ''}.jpg` : null;

/* 사진: assets/art.js(window.SITE_ART)에서 — 교체는 그 파일에서 */
const artOf = (key, kind) => {
  const A = window.SITE_ART;
  return (A.products[key] && A.products[key][kind]) || A.home;
};

/* ---------- 캔버스 좌표계 ---------- */
let VW = window.innerWidth, VH = window.innerHeight;
const GX = () => VW * 1.35;
const GY = () => VH * 1.25;

const tracks = new Map();
let navStack = [];

function trackBaseY(tr) { return tr.parent ? trackBaseY(tr.parent) + tr.entryRow * GY() : 0; }
function scenePos(tr, row) { return { x: tr.col * GX(), y: trackBaseY(tr) + row * GY() }; }

function getTrack(key, builder) {
  if (tracks.has(key)) return tracks.get(key);
  const cur = navStack[navStack.length - 1];
  const tr = {
    key,
    col: cur ? cur.track.col + 1 : 0,
    parent: cur ? cur.track : null,
    entryRow: cur ? cur.row : 0,
    scenes: [],
    visited: new Set(),
  };
  tracks.set(key, tr);
  builder(tr);
  layoutTrack(tr);
  return tr;
}

/* primary: 이 장면의 → (오른쪽 키) 대표 행동. 없으면 →는 다음 장면으로 진행 */
function addScene(tr, title, cls, html, primary) {
  const el = document.createElement('section');
  el.className = `scene ${cls}`;
  el.innerHTML = html;
  canvas.appendChild(el);
  tr.scenes.push({ title, el, row: tr.scenes.length, primary: primary || null });
  return el;
}

function layoutTrack(tr) {
  tr.scenes.forEach(sc => {
    const p = scenePos(tr, sc.row);
    sc.el.style.left = p.x + 'px';
    sc.el.style.top = p.y + 'px';
    sc.el.style.width = VW + 'px';
    sc.el.style.height = VH + 'px';
  });
}

function layoutAll() {
  VW = window.innerWidth; VH = window.innerHeight;
  tracks.forEach(layoutTrack);
}

/* ---------- 카메라 ----------
 * 표준 3키프레임 비행: 출발 → (중간 줌아웃) → 도착. 거리 비례 시간,
 * 양 끝을 길게 무는 easing으로 '떠올랐다 내려앉는' 부드러움을 만든다. */
let cam = { x: 0, y: 0 };
let flying = null;
const tf = (c, s = 1) => `scale(${s}) translate(${-c.x}px, ${-c.y}px)`;

function flyTo(x, y, opts = {}) {
  if (flying) { flying.cancel(); flying = null; }
  const from = { ...cam };
  cam = { x, y };
  canvas.style.transform = tf(cam);
  if (opts.instant) return;
  const dist = Math.hypot(x - from.x, y - from.y);
  if (dist < 1) return;
  const dur = Math.min(2000, 800 + dist * 0.22);
  const far = dist > VW * 0.9;
  const midS = far ? 0.5 : dist > VW * 0.35 ? 0.82 : 0.95;
  const mid = { x: (from.x + x) / 2, y: (from.y + y) / 2 };
  flying = canvas.animate([
    { transform: tf(from), easing: 'cubic-bezier(.55,0,.35,1)' },
    { transform: tf(mid, midS), offset: 0.5, easing: 'cubic-bezier(.65,0,.45,1)' },
    { transform: tf(cam) },
  ], { duration: dur });
  flying.onfinish = () => { flying = null; };
}

/* ---------- 내비게이션 ---------- */
function current() { return navStack[navStack.length - 1]; }

function activate() {
  const cur = current();
  const tr = cur.track;
  tr.visited.add(cur.row);
  const live = new Set(navStack.map(e => e.track));
  tracks.forEach(x => x.scenes.forEach(sc => {
    sc.el.classList.toggle('offstage', !live.has(x));
    sc.el.classList.toggle('active', x === tr && sc.row === cur.row);
  }));
  const p = scenePos(tr, cur.row);
  flyTo(p.x, p.y);
  backBtn.hidden = navStack.length <= 1;
  renderRail();
  renderLoc();
  renderHint();
  syncHash();
}

function goRow(row) {
  const cur = current();
  if (row < 0 || row >= cur.track.scenes.length || row === cur.row) return;
  cur.row = row;
  activate();
}

function goPrimary() {
  // → 키는 어느 장면에서든 반드시 동작한다:
  // 대표 행동(더 깊이) → 없으면 다음 장면 → 마지막 장면이면 이전 깊이로 복귀.
  const cur = current();
  const sc = cur.track.scenes[cur.row];
  if (sc.primary) { sc.primary(); return; }
  if (cur.row < cur.track.scenes.length - 1) { goRow(cur.row + 1); return; }
  popTrack();
}

function pushTrack(key, builder, row = 0) {
  const tr = getTrack(key, builder);
  navStack.push({ track: tr, row: Math.max(0, Math.min(row, tr.scenes.length - 1)) });
  activate();
}

function popTrack() {
  if (navStack.length <= 1) return;
  navStack.pop();
  activate();
}

function resetHome(row = 0) {
  navStack = [{ track: getTrack('home', buildHome), row }];
  activate();
}

/* ---------- HUD ---------- */
function renderRail() {
  const cur = current();
  const tr = cur.track;
  railDashes.innerHTML = tr.scenes.map(sc => `
    <button class="rail-dash ${sc.row === cur.row ? 'on' : ''} ${tr.visited.has(sc.row) ? 'seen' : ''}"
      data-row="${sc.row}" aria-label="${esc(sc.title)}"></button>`).join('');
  railPanel.innerHTML = `
    <p class="rail-panel-head">${esc(trackLabel(tr))}</p>
    ${tr.scenes.map(sc => `
      <button class="rail-item ${sc.row === cur.row ? 'on' : ''}" data-row="${sc.row}">
        <span class="rail-idx">${String(sc.row + 1).padStart(2, '0')}</span>${esc(sc.title)}
      </button>`).join('')}`;
  railEl.querySelectorAll('[data-row]').forEach(b =>
    b.addEventListener('click', () => goRow(+b.dataset.row)));
}

function trackLabel(tr) {
  if (tr.key === 'home') return t('homeTrack');
  if (tr.key.startsWith('p:')) { const p = productOf(tr.key.slice(2)); return p ? `${p.emoji} ${p.name}` : tr.key; }
  if (tr.key.startsWith('s:')) { const s = seriesOf(tr.key.slice(2)); return s ? `${s.emoji} ${sTr(s).title}` : tr.key; }
  if (tr.key.startsWith('a:')) { const c = contentOf(tr.key.slice(2)); return c ? cTitle(c) : tr.key; }
  if (tr.key.startsWith('nl:')) return t('newsletterTrack');
  return tr.key;
}

function renderLoc() {
  hudLoc.innerHTML = navStack.map((e, i) =>
    i === navStack.length - 1
      ? `<strong>${esc(trackLabel(e.track))}</strong>`
      : `<button class="loc-jump" data-depth="${i}">${esc(trackLabel(e.track))}</button>`
  ).join('<span class="loc-sep">›</span>');
  hudLoc.querySelectorAll('.loc-jump').forEach(b =>
    b.addEventListener('click', () => { navStack = navStack.slice(0, +b.dataset.depth + 1); activate(); }));
}

function renderHint() {
  const cur = current();
  const last = cur.row === cur.track.scenes.length - 1;
  hudHint.textContent = cur.track.key === 'home'
    ? (last ? t('hintHomeLast') : t('hintHome'))
    : (last ? t('hintDeepLast') : t('hintDeep'));
}

function renderBrand() {
  document.querySelector('#hud-brand .brand-text strong').textContent = t('brandStrong');
  document.querySelector('#hud-brand .brand-text small').textContent = t('brandSmall');
  backBtn.textContent = t('back');
  langBtn.textContent = LANG === 'en' ? '한국어' : 'EN';
}

/* ---------- 해시 라우팅 ---------- */
function serialize() {
  const cur = current();
  if (!cur) return location.hash || '#/h/0'; // 언어 전환 재구성 중 가드
  const tr = cur.track;
  if (tr.key === 'home') return `#/h/${cur.row}`;
  if (tr.key.startsWith('p:')) return `#/p/${tr.key.slice(2)}/${cur.row}`;
  if (tr.key.startsWith('s:')) return `#/s/${tr.key.slice(2)}`;
  if (tr.key.startsWith('a:')) return `#/a/${tr.key.slice(2)}`;
  if (tr.key.startsWith('nl:')) return `#/nl/${tr.key.slice(2)}`;
  return '#/h/0';
}
function syncHash() {
  if (location.hash !== serialize()) location.hash = serialize();
}
function routeFromHash() {
  const parts = (location.hash || '#/').slice(2).split('/').map(decodeURIComponent);
  const [kind, a, b] = parts;
  resetHome(0);
  if (kind === 'h') { goRow(Math.min(+a || 0, current().track.scenes.length - 1)); return; }
  if (kind === 'p' && productOf(a)) {
    goRow(homeRowOfProduct(a));
    pushTrack('p:' + a, tr => buildProduct(tr, productOf(a)), Math.max(0, +b || 0));
    return;
  }
  if (kind === 's' && seriesOf(a)) { goRow(HOME_STORIES_ROW()); pushSeries(a); return; }
  if ((kind === 'a' || kind === 'c') && contentOf(a)) { openArticleDeep(a); return; }
  if (kind === 'nl' || kind === 'n') {
    goRow(HOME_NL_ROW());
    const nl = (DB.newsletters || []).find(n => n.id === a);
    if (nl) pushTrack('nl:' + a, tr => buildNewsletter(tr, nl));
    return;
  }
  if (kind === 't') goRow(HOME_STORIES_ROW());
}
function openArticleDeep(cid) {
  const born = productsOfStory(cid);
  if (born.length) {
    const key = born[0].p.key;
    goRow(homeRowOfProduct(key));
    pushTrack('p:' + key, tr => buildProduct(tr, productOf(key)));
  } else {
    const s = seriesOfContent(cid);
    goRow(HOME_STORIES_ROW());
    if (s) pushSeries(s.id);
  }
  pushArticle(cid);
}

/* ================================================================
 * 장면 빌더
 * ================================================================ */
const homeRowOfProduct = (key) => 1 + Math.max(0, (DB.products || []).findIndex(p => p.key === key));
const HOME_STORIES_ROW = () => 1 + (DB.products || []).length;
const HOME_NL_ROW = () => 2 + (DB.products || []).length;

const kicker = (txt) => `<p class="kicker">${txt}</p>`;
const cue = `<button class="scroll-cue" data-next aria-label="next">⌄</button>`;
const bgArt = (url, cls = '') => `<div class="scene-bg ${cls}" style="background-image:url('${esc(url)}')"></div><div class="scene-veil"></div>`;

function buildHome(tr) {
  const A = window.SITE_ART;
  const products = DB.products || [];

  /* 0 — 인트로 */
  addScene(tr, LANG === 'en' ? 'Intro — Questions from the stands' : '인트로 — 관중석의 질문', 'sc-hero', `
    ${bgArt(A.home)}
    <div class="inner center">
      ${kicker(t('introKicker'))}
      <h1 class="display">${t('introTitle')}</h1>
      <p class="lead">${t('introLead')}</p>
      <div class="stat-row">
        <span class="stat"><b>${products.length}</b>${t('statServices')}</span>
        <span class="stat"><b>${DB.series.length}</b>${t('statSeries')}</span>
        <span class="stat"><b>${DB.contents.length}</b>${t('statStories')}</span>
      </div>
    </div>
    ${cue}`,
    () => goRow(1));

  /* 1..N — 서비스 (한 페이지 = 한 서비스) */
  products.forEach((raw, i) => {
    const p = pTr(raw);
    const open = () => pushTrack('p:' + p.key, x => buildProduct(x, raw));
    const st = p.status === 'live'
      ? `<span class="badge live">${t('badgeLive')}</span>`
      : `<span class="badge building">${t('badgeBuilding')}</span>`;
    const el = addScene(tr, `${p.emoji} ${p.name}`, 'sc-promo', `
      <div class="inner split">
        <div class="split-text">
          <span class="giant-num">0${i + 1}</span>
          ${kicker(`${t('serviceKicker')} ${i + 1} / ${products.length}`)}
          <h2 class="display">${p.emoji} ${esc(p.name)}</h2>
          <p class="tagline">${esc(p.tagline)}</p>
          <p class="lead">${esc(p.problem)}</p>
          ${st}
          <div><button class="cta" data-open>${t('intoStory')} <span class="arrow">→</span></button></div>
        </div>
        <div class="split-art" data-open role="button" tabindex="0">
          <figure class="art-frame"><img src="${esc(artOf(p.key, 'hero'))}" alt="${esc(p.name)}" loading="lazy"/></figure>
          <span class="art-hint">${t('artHint')}</span>
        </div>
      </div>
      ${cue}`,
      open);
    el.querySelectorAll('[data-open]').forEach(n => n.addEventListener('click', open));
  });

  /* N+1 — 이야기 허브 */
  const openFirstSeries = () => pushSeries(DB.series[0].id);
  const hub = addScene(tr, LANG === 'en' ? 'Origin stories' : '서비스가 태어난 이야기', 'sc-hub', `
    ${bgArt(A.stories, 'faint')}
    <div class="inner">
      ${kicker(t('hubKicker'))}
      <h2 class="display sm">${t('hubTitle')}</h2>
      <p class="lead">${t('hubLead')}</p>
      <div class="scroll-area hub-grid">
        ${DB.series.map(s => {
          const url = coverUrl(s);
          const x = sTr(s);
          return `
          <button class="hub-card" data-series="${s.id}">
            <span class="hub-thumb">${url ? `<img src="${esc(url)}" alt="" loading="lazy"/>` : ''}</span>
            <span class="hub-body"><b>${s.emoji} ${esc(x.title)}</b><small>${esc(x.question)}</small></span>
          </button>`;
        }).join('')}
      </div>
    </div>
    ${cue}`,
    openFirstSeries);
  hub.querySelectorAll('[data-series]').forEach(n =>
    n.addEventListener('click', () => pushSeries(n.dataset.series)));

  /* N+2 — 뉴스레터 */
  const nls = DB.newsletters || [];
  const openFirstNl = nls.length ? () => pushTrack('nl:' + nls[0].id, x => buildNewsletter(x, nls[0])) : null;
  const nlScene = addScene(tr, t('newsletterTrack'), 'sc-nl', `
    <div class="inner center">
      ${kicker(t('nlKicker'))}
      <h2 class="display sm">${t('nlTitle')}</h2>
      <p class="lead">${t('nlLead')}</p>
      <div class="nl-list narrow">
        ${nls.length ? nls.map(n => {
          const p = productOf(n.product);
          return `
          <button class="nl-card" data-nl="${n.id}">
            <span class="nl-meta">${p ? `${p.emoji} ${esc(p.name)}` : ''} · ${esc(n.version || '')} · ${esc(fmtDate(n.date))}</span>
            <b>${esc(n.title)}</b>
            <span class="nl-open">${t('read')}</span>
          </button>`;
        }).join('') : `<p class="lead dim">${t('nlEmpty')}</p>`}
      </div>
      <p class="foot-note">${t('footNote')} <a href="https://github.com/kyj5482" target="_blank" rel="noopener">GitHub @kyj5482</a></p>
    </div>`,
    openFirstNl);
  nlScene.querySelectorAll('[data-nl]').forEach(n =>
    n.addEventListener('click', () => {
      const nl = nls.find(x => x.id === n.dataset.nl);
      pushTrack('nl:' + nl.id, x => buildNewsletter(x, nl));
    }));
}

/* ---------- 서비스 트랙 ---------- */
function buildProduct(tr, raw) {
  const p = pTr(raw);
  const st = p.status === 'live'
    ? `<span class="badge live">${t('badgeLive')}</span>`
    : `<span class="badge building">${t('badgeBuilding')}</span>`;

  addScene(tr, LANG === 'en' ? `${p.name} — Opening` : `${p.name} — 시작`, 'sc-hero sc-p-hero', `
    ${bgArt(artOf(p.key, 'hero'))}
    <div class="inner center">
      ${kicker(t('storyKicker'))}
      <h1 class="display">${p.emoji} ${esc(p.name)}</h1>
      <p class="tagline">${esc(p.tagline)}</p>
      ${st}
      <p class="lead dim">${t('scrollNote')}</p>
    </div>
    ${cue}`,
    () => goRow(1));

  addScene(tr, LANG === 'en' ? 'The problem' : '풀려는 문제', 'sc-narr', `
    <div class="inner split">
      <div class="split-text">
        ${kicker(t('ch1Kicker'))}
        <h2 class="display sm">${t('ch1Title')}</h2>
        <blockquote class="big-quote">${esc(p.problem)}</blockquote>
      </div>
      <div class="split-art"><figure class="art-frame tilt"><img src="${esc(artOf(p.key, 'problem'))}" alt="" loading="lazy"/></figure></div>
    </div>
    ${cue}`,
    () => goRow(2));

  addScene(tr, LANG === 'en' ? 'The origin' : '누가, 왜 만들었나', 'sc-narr', `
    <div class="inner split rev">
      <div class="split-text">
        ${kicker(t('ch2Kicker'))}
        <h2 class="display sm">${t('ch2Title')}</h2>
        <p class="lead">${esc(p.origin)}</p>
      </div>
      <div class="split-art"><figure class="art-frame tilt-l"><img src="${esc(artOf(p.key, 'origin'))}" alt="" loading="lazy"/></figure></div>
    </div>
    ${cue}`,
    () => goRow(3));

  (p.features || []).forEach((f, i) => {
    const readable = (f.stories || []).map(contentOf).filter(c => c && !isPlanned(c));
    const primary = readable.length ? () => pushArticle(readable[0].id) : null;
    const stories = (f.stories || []).map(cid => {
      const c = contentOf(cid);
      if (!c) return '';
      return isPlanned(c)
        ? `<span class="story-link locked">🔒 ${esc(cTitle(c))}<small>${esc(publishLabel(c))}</small></span>`
        : `<button class="story-link" data-article="${cid}">${esc(cTitle(c))}<small>${t('readStory')}</small></button>`;
    }).join('');
    const el = addScene(tr, `${LANG === 'en' ? 'Feature' : '기능'} ${i + 1} — ${f.name}`, 'sc-feat', `
      <div class="inner split">
        <div class="split-text">
          <span class="giant-num soft">F${i + 1}</span>
          ${kicker(`${t('featureKicker')} ${i + 1} / ${p.features.length}`)}
          <h2 class="display sm">${esc(f.name)}</h2>
          <p class="lead">${esc(f.desc)}</p>
        </div>
        <div class="split-art">
          <div class="story-panel">
            <p class="story-panel-head">${t('storyBehind')}</p>
            ${stories || `<p class="dim">${t('storyPreparing')}</p>`}
          </div>
        </div>
      </div>
      ${cue}`,
      primary);
    el.querySelectorAll('[data-article]').forEach(n =>
      n.addEventListener('click', () => pushArticle(n.dataset.article)));
  });

  const nls = (DB.newsletters || []).filter(n => n.product === p.key);
  const ctaEl = addScene(tr, LANG === 'en' ? 'Join the story' : '함께하기', 'sc-cta', `
    ${bgArt(artOf(p.key, 'hero'), 'faint')}
    <div class="inner center">
      ${kicker(t('joinKicker'))}
      <h2 class="display sm">${t('joinTitle')}</h2>
      <ul class="who-list">${(p.forWho || []).map(w => `<li>${esc(w)}</li>`).join('')}</ul>
      <div class="cta-row">
        <a class="cta ghosted" href="${esc(p.repo)}" target="_blank" rel="noopener">${t('ctaGithub')}</a>
        ${p.site
          ? `<a class="cta" href="${esc(p.site)}" target="_blank" rel="noopener">${t('ctaUse')}</a>`
          : `<span class="cta soon">${t('ctaSoon')}</span>`}
        ${(p.links || []).map(l => `<a class="cta ghosted" href="${esc(l.url)}" target="_blank" rel="noopener">🔗 ${esc(l.label)}</a>`).join('')}
      </div>
      ${nls.length ? `<div class="nl-list narrow">${nls.map(n => `
        <button class="nl-card" data-nl="${n.id}">
          <span class="nl-meta">${esc(n.version || '')} · ${esc(fmtDate(n.date))}</span>
          <b>${esc(n.title)}</b><span class="nl-open">${t('read')}</span>
        </button>`).join('')}</div>` : ''}
    </div>`,
    () => window.open(p.site || p.repo, '_blank'));
  ctaEl.querySelectorAll('[data-nl]').forEach(n =>
    n.addEventListener('click', () => {
      const nl = nls.find(x => x.id === n.dataset.nl);
      pushTrack('nl:' + nl.id, x => buildNewsletter(x, nl));
    }));
}

/* ---------- 시리즈 트랙 ---------- */
function pushSeries(sid) {
  pushTrack('s:' + sid, tr => {
    const s = seriesOf(sid);
    const x = sTr(s);
    const url = coverUrl(s);
    const readable = s.articles.map(contentOf).filter(c => c && !isPlanned(c));
    const el = addScene(tr, `${s.emoji} ${x.title}`, 'sc-series', `
      ${url ? bgArt(url, 'faint') : ''}
      <div class="inner">
        ${kicker(t('seriesKicker'))}
        <h2 class="display sm">${s.emoji} ${esc(x.title)}</h2>
        <p class="lead">${esc(x.question)}</p>
        <div class="scroll-area ep-list">
          ${s.articles.map((cid, i) => {
            const c = contentOf(cid);
            return isPlanned(c)
              ? `<span class="ep locked"><span class="ep-num">${i + 1}</span><b>${esc(cTitle(c))}</b><small>🔒 ${esc(publishLabel(c))}</small></span>`
              : `<button class="ep" data-article="${cid}"><span class="ep-num">${i + 1}</span><b>${esc(cTitle(c))}</b><small>${t('read')}</small></button>`;
          }).join('')}
        </div>
      </div>`,
      readable.length ? () => pushArticle(readable[0].id) : null);
    el.querySelectorAll('[data-article]').forEach(n =>
      n.addEventListener('click', () => pushArticle(n.dataset.article)));
  });
}

/* ---------- 글 트랙 — 무대 위에서 이어지는 리딩 장면 ----------
 * 팝업 카드가 아니라 프레젠테이션의 다음 장면: 시리즈 컨텍스트 키커 +
 * 세리프 대제목 + 본문이 캔버스 배경 위에 그대로 흐른다. */
function pushArticle(cid) {
  pushTrack('a:' + cid, tr => {
    const c = contentOf(cid);
    const s = seriesOfContent(cid);
    const sx = s ? sTr(s) : null;
    // → 키: 같은 시리즈의 다음 게시 글로 이어 읽기 (없으면 goPrimary 폴백이 처리)
    let next = null;
    if (s) {
      const idx = s.articles.indexOf(cid);
      const nid = s.articles.slice(idx + 1).find(x => !isPlanned(contentOf(x)));
      if (nid) next = () => { navStack.pop(); pushArticle(nid); };
    }
    const el = addScene(tr, cTitle(c), 'sc-article', `
      <div class="inner reading scroll-area">
        ${kicker(s ? `${s.emoji} ${esc(sx.title)}` : t('seriesKicker'))}
        <h1 class="display sm article-title">${esc(cTitle(c))}</h1>
        ${LANG === 'en' ? `<p class="lang-note">${t('koreanNote')}</p>` : ''}
        <div class="article-body"><p class="dim">${t('loading')}</p></div>
      </div>`,
      next);
    loadMarkdown(el.querySelector('.article-body'), c.file, cid);
  });
}

function buildNewsletter(tr, nl) {
  const el = addScene(tr, nl.title, 'sc-article', `
    <div class="inner reading scroll-area">
      ${kicker(t('nlKicker'))}
      <div class="article-body"><p class="dim">${t('loading')}</p></div>
    </div>`);
  loadMarkdown(el.querySelector('.article-body'), nl.file, null);
}

async function loadMarkdown(bodyEl, file, cid) {
  try {
    const md = await fetch(withVer(file)).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
    const body = md.replace(/^\s*---\s*\n[\s\S]*?\n---\s*\n?/, '');
    bodyEl.innerHTML = marked.parse(body);
    // 장면 헤더에 이미 제목을 크게 얹었으므로 본문 첫 H1은 숨긴다 (제목 중복 방지)
    if (cid) { const h1 = bodyEl.querySelector('h1'); if (h1) h1.remove(); }
    const slugKey = (path) => path.split('/').pop().replace(/\.md$/, '').replace(/^\d+-/, '');
    bodyEl.querySelectorAll('a[href$=".md"]').forEach(a => {
      const target = DB.contents.find(x => slugKey(x.file) === slugKey(a.getAttribute('href')));
      if (target && !isPlanned(target)) {
        a.setAttribute('href', 'javascript:void 0');
        a.addEventListener('click', () => { navStack.pop(); pushArticle(target.id); });
      } else {
        const span = document.createElement('span'); span.textContent = a.textContent; a.replaceWith(span);
      }
    });
    if (cid) {
      const born = productsOfStory(cid);
      if (born.length) {
        const div = document.createElement('div');
        div.className = 'born-box';
        div.innerHTML = `<p class="story-panel-head">${t('bornFrom')}</p>` + born.map(({ p, feats }) => {
          const px = pTr(p);
          return `<button class="story-link" data-product="${p.key}">${p.emoji} ${esc(p.name)} — ${feats.map((f, i) => {
            const fi = p.features.indexOf(f);
            return esc((px.features[fi] || f).name);
          }).join(' · ')}<small>${t('seeService')}</small></button>`;
        }).join('');
        bodyEl.appendChild(div);
        div.querySelectorAll('[data-product]').forEach(n => n.addEventListener('click', () => {
          const key = n.dataset.product;
          resetHome(homeRowOfProduct(key));
          pushTrack('p:' + key, x => buildProduct(x, productOf(key)));
        }));
      }
    }
  } catch (e) {
    bodyEl.innerHTML = `<p class="dim">${t('loadFail')}</p>`;
  }
}

/* ================================================================
 * 입력
 * ================================================================ */
let wheelLock = 0;
function canScrollInside(el, dy) {
  const area = el && el.closest && el.closest('.scroll-area');
  if (!area) return false;
  if (dy > 0) return area.scrollTop + area.clientHeight < area.scrollHeight - 2;
  return area.scrollTop > 2;
}
stage.addEventListener('wheel', (e) => {
  if (canScrollInside(e.target, e.deltaY)) return;
  e.preventDefault();
  const now = Date.now();
  if (now - wheelLock < 950 || Math.abs(e.deltaY) < 12) return;
  wheelLock = now;
  goRow(current().row + (e.deltaY > 0 ? 1 : -1));
}, { passive: false });

let touchY = null, touchX = null;
stage.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; touchX = e.touches[0].clientX; }, { passive: true });
stage.addEventListener('touchend', (e) => {
  if (touchY == null) return;
  const dy = touchY - e.changedTouches[0].clientY;
  const dx = touchX - e.changedTouches[0].clientX;
  touchY = touchX = null;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < -70) popTrack();       // → 스와이프: 뒤로
    else if (dx > 70) goPrimary();  // ← 스와이프: 더 깊이
    return;
  }
  if (Math.abs(dy) < 60) return;
  if (canScrollInside(e.target, dy)) return;
  goRow(current().row + (dy > 0 ? 1 : -1));
}, { passive: true });

window.addEventListener('keydown', (e) => {
  // 포커스된 버튼/링크의 Enter는 그 요소의 클릭에 맡긴다 (이중 동작 방지)
  if (e.key === 'Enter' && e.target.closest && e.target.closest('button, a')) return;
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); goRow(current().row + 1); }
  else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goRow(current().row - 1); }
  else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); goPrimary(); }
  else if (e.key === 'Escape' || e.key === 'ArrowLeft') { e.preventDefault(); popTrack(); }
  else if (e.key === 'Home') resetHome(0);
});

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-next]')) goRow(current().row + 1);
});
backBtn.addEventListener('click', popTrack);
document.getElementById('hud-brand').addEventListener('click', () => resetHome(0));

/* 언어 전환: 캔버스를 비우고 현재 위치를 같은 해시로 재구성 */
langBtn.addEventListener('click', () => {
  LANG = LANG === 'en' ? 'ko' : 'en';
  localStorage.setItem(LANG_KEY, LANG);
  document.documentElement.lang = LANG;
  rebuild();
});
function rebuild() {
  const hash = serialize();
  tracks.clear();
  canvas.innerHTML = '';
  navStack = [];
  renderBrand();
  location.hash = hash;   // 동일 해시면 이벤트가 안 오므로 직접 라우팅도 호출
  routeFromHash();
}

railEl.addEventListener('mouseenter', () => { railPanel.hidden = false; });
railEl.addEventListener('mouseleave', () => { railPanel.hidden = true; });

window.addEventListener('resize', () => {
  layoutAll();
  const cur = current();
  if (cur) { const p = scenePos(cur.track, cur.row); flyTo(p.x, p.y, { instant: true }); }
});

window.addEventListener('hashchange', () => { if (location.hash !== serialize()) routeFromHash(); });

/* ---------- 시작 ---------- */
(async function init() {
  document.documentElement.lang = LANG;
  DB = await fetch(withVer('data/contents.json')).then(r => r.json());
  renderBrand();
  routeFromHash();
})();
