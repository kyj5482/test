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
/* 서비스별 챕터 문구 — i18n.ui.chapters[key][field]. 없으면 공용 t(field)로 폴백. */
const tc = (key, field) => {
  const c = (window.I18N.ui.chapters || {})[key];
  const v = c && c[field];
  if (v) return v[LANG] || v.en || '';
  return window.I18N.ui[field] ? t(field) : '';
};

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

/* 아이콘 — 이모지 대신 라인 SVG (assets/icons.js). 없으면 빈 문자열로 안전 폴백 */
const IC = window.SITE_ICONS || { icon: () => '', product: () => '', track: () => '', series: () => '', has: () => false };

/* 상태 배지 (아이콘 + 라벨) */
const badgeOf = (p) => p.status === 'live'
  ? `<span class="badge live">${IC.icon('dot')}${t('badgeLive')}</span>`
  : `<span class="badge building">${IC.icon('spark')}${t('badgeBuilding')}</span>`;

/* 제품이 뿌리로 삼은 모든 스토리 id (기능별 stories 합집합) */
const storiesOfProduct = (p) => [...new Set((p.features || []).flatMap(f => f.stories || []))];

/* 마인드맵 연결: 같은 스토리를 공유하는 '다른' 서비스들 (서비스↔서비스 링크의 원천) */
const relatedProducts = (key) => {
  const me = productOf(key);
  if (!me) return [];
  const mine = new Set(storiesOfProduct(me));
  return (DB.products || []).filter(p => p.key !== key && storiesOfProduct(p).some(s => mine.has(s)));
};

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

/* ---------- 캔버스 좌표계 ----------
 * 장면을 화면 크기 그대로(간격 0) 타일링한다 → 전환이 '현재 화면은 왼쪽으로,
 * 오른쪽 화면은 제자리로' 미끄러지는 매끄러운 슬라이드가 되고, 장면 사이 틈(흰 띠)도 없다. */
let VW = window.innerWidth, VH = window.innerHeight;
const GX = () => VW;
const GY = () => VH;

const tracks = new Map();
let navStack = [];

function trackBaseY(tr) { return tr.parent ? trackBaseY(tr.parent) + tr.entryRow * GY() : 0; }
function scenePos(tr, row) { return { x: tr.col * GX(), y: trackBaseY(tr) + row * GY() }; }

function getTrack(key, builder) {
  if (tracks.has(key)) return tracks.get(key);
  const cur = navStack[navStack.length - 1];
  // overview(전체 지도)는 홈 왼쪽의 고정 좌표에 놓아, 홈에서 왼쪽으로 크게 줌아웃하는 비행을 만든다
  const isOverview = key === 'overview';
  const tr = {
    key,
    col: isOverview ? -1 : (cur ? cur.track.col + 1 : 0),
    parent: null,
    entryRow: 0,
    scenes: [],
    visited: new Set(),
  };
  if (!isOverview && cur) { tr.parent = cur.track; tr.entryRow = cur.row; }
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
    // 이웃 장면과 1px 겹치게 살짝 키운다 → 슬라이드 중 서브픽셀 틈(흰 깜빡임)이 원천 차단된다
    sc.el.style.width = (VW + 1) + 'px';
    sc.el.style.height = (VH + 1) + 'px';
  });
}

function layoutAll() {
  VW = window.innerWidth; VH = window.innerHeight;
  tracks.forEach(layoutTrack);
}

/* ---------- 카메라 ----------
 * 순수 슬라이드 팬: 줌아웃 없이 카메라를 목적지로 곧장 평행이동한다.
 * → 오른쪽 클릭 시 현재 장면이 왼쪽으로 밀려나고 오른쪽 장면이 제자리로 들어온다.
 * 이동 거리에 비례해 시간을 살짝 늘리되, 슬라이드 한 칸은 짧고 매끄럽게. */
let cam = { x: 0, y: 0 };
let flying = null;
const tf = (c) => `translate(${-c.x}px, ${-c.y}px)`;

function flyTo(x, y, opts = {}) {
  if (flying) { flying.cancel(); flying = null; }
  const from = { ...cam };
  cam = { x, y };
  canvas.style.transform = tf(cam);
  if (opts.instant) return;
  const dist = Math.hypot(x - from.x, y - from.y);
  if (dist < 1) return;
  const steps = Math.hypot((x - from.x) / GX(), (y - from.y) / GY());
  // 한 칸 슬라이드는 짧게(≈520ms), 여러 칸 점프는 조금 더 길게(최대 900ms).
  const dur = Math.max(420, Math.min(900, 440 + steps * 120));
  flying = canvas.animate(
    [{ transform: tf(from) }, { transform: tf(cam) }],
    { duration: dur, easing: 'cubic-bezier(.42,0,.2,1)' }
  );
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
  // 글 트랙에서 소제목(H2)을 수집했으면, 레일은 씬 대신 '단락 목차'가 된다.
  if (tr.sections && tr.sections.length) { renderRailSections(tr); return; }
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

/* 글 단락 목차 레일 — 대시는 소제목 하나당 하나, 클릭·호버로 그 단락으로 스크롤 */
function renderRailSections(tr) {
  const secs = tr.sections;
  const cur = tr.activeSection || 0;
  railDashes.innerHTML = secs.map((sec, i) => `
    <button class="rail-dash ${i === cur ? 'on' : ''}" data-sec="${i}" aria-label="${esc(sec.title)}"></button>`).join('');
  railPanel.innerHTML = `
    <p class="rail-panel-head">${esc(trackLabel(tr))}</p>
    ${secs.map((sec, i) => `
      <button class="rail-item ${i === cur ? 'on' : ''}" data-sec="${i}">
        <span class="rail-idx">${String(i + 1).padStart(2, '0')}</span>${esc(sec.title)}
      </button>`).join('')}`;
  railEl.querySelectorAll('[data-sec]').forEach(b =>
    b.addEventListener('click', () => scrollToSection(tr, +b.dataset.sec)));
}

function scrollToSection(tr, i) {
  const sec = tr.sections && tr.sections[i];
  if (!sec) return;
  sec.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* 스크롤 스파이: 리딩 영역을 스크롤하면 현재 보고 있는 소제목을 레일에 반영 */
function attachScrollSpy(tr) {
  const scroller = tr.scroller;
  if (!scroller || tr._spy) return;
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const top = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.28;
      let idx = 0;
      tr.sections.forEach((sec, i) => { if (sec.el.getBoundingClientRect().top <= top) idx = i; });
      if (idx !== tr.activeSection) { tr.activeSection = idx; if (current().track === tr) renderRailSections(tr); }
    });
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });
  tr._spy = onScroll;
}

/* 브레드크럼/레일용 라벨 — 텍스트만. 아이콘은 호출부에서 별도로 붙인다 */
function trackLabel(tr) {
  if (tr.key === 'home') return t('homeTrack');
  if (tr.key === 'overview') return t('overviewTrack');
  if (tr.key.startsWith('p:')) { const p = productOf(tr.key.slice(2)); return p ? p.name : tr.key; }
  if (tr.key.startsWith('s:')) { const s = seriesOf(tr.key.slice(2)); return s ? sTr(s).title : tr.key; }
  if (tr.key.startsWith('a:')) { const c = contentOf(tr.key.slice(2)); return c ? cTitle(c) : tr.key; }
  if (tr.key.startsWith('nl:')) return t('newsletterTrack');
  return tr.key;
}

/* 트랙 종류별 작은 아이콘 (브레드크럼용) */
function trackIcon(tr) {
  if (tr.key === 'overview') return IC.icon('map', 'loc-ic');
  if (tr.key.startsWith('p:')) return IC.product(tr.key.slice(2), 'loc-ic');
  if (tr.key.startsWith('s:')) return IC.series(tr.key.slice(2), 'loc-ic');
  if (tr.key.startsWith('nl:')) return IC.icon('letter', 'loc-ic');
  return '';
}

function renderLoc() {
  hudLoc.innerHTML = navStack.map((e, i) =>
    i === navStack.length - 1
      ? `<strong>${trackIcon(e.track)}${esc(trackLabel(e.track))}</strong>`
      : `<button class="loc-jump" data-depth="${i}">${trackIcon(e.track)}${esc(trackLabel(e.track))}</button>`
  ).join('<span class="loc-sep">›</span>');
  hudLoc.querySelectorAll('.loc-jump').forEach(b =>
    b.addEventListener('click', () => { navStack = navStack.slice(0, +b.dataset.depth + 1); activate(); }));
}

function renderHint() {
  const cur = current();
  const last = cur.row === cur.track.scenes.length - 1;
  hudHint.textContent = cur.track.key === 'overview'
    ? t('mapHint')
    : cur.track.key === 'home'
      ? (last ? t('hintHomeLast') : t('hintHome'))
      : (last ? t('hintDeepLast') : t('hintDeep'));
}

function renderBrand() {
  document.querySelector('#hud-brand .brand-text strong').textContent = t('brandStrong');
  document.querySelector('#hud-brand .brand-text small').textContent = t('brandSmall');
  backBtn.innerHTML = `${IC.icon('back', 'cta-ic')}${t('back')}`;
  const mapBtn = document.getElementById('nav-map');
  if (mapBtn) mapBtn.innerHTML = `${IC.icon('map', 'cta-ic')}${t('mapBtn')}`;
  langBtn.textContent = LANG === 'en' ? '한국어' : 'EN';
}

/* ---------- 해시 라우팅 ---------- */
function serialize() {
  const cur = current();
  if (!cur) return location.hash || '#/h/0'; // 언어 전환 재구성 중 가드
  const tr = cur.track;
  if (tr.key === 'overview') return `#/map`;
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
  if (kind === 'map') { openOverview(); return; }
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
const cue = `<button class="scroll-cue" data-next aria-label="next">${IC.icon('chevronDown')}</button>`;
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

  /* 1..N — 서비스 (한 페이지 = 한 서비스) · 풀블리드 시네마틱 */
  products.forEach((raw, i) => {
    const p = pTr(raw);
    const open = () => pushTrack('p:' + p.key, x => buildProduct(x, raw));
    const el = addScene(tr, p.name, 'sc-promo cine', `
      ${bgArt(artOf(p.key, 'hero'), 'cine-bg')}
      <div class="inner cine-inner">
        <div class="cine-block">
          <span class="giant-num">${String(i + 1).padStart(2, '0')}</span>
          ${kicker(`${t('serviceKicker')} · ${String(i + 1).padStart(2, '0')} / ${String(products.length).padStart(2, '0')}`)}
          <h2 class="display prod-name">${IC.product(p.key, 'title-ic')}${esc(p.name)}</h2>
          <p class="tagline">${esc(p.tagline)}</p>
          <p class="lead clamp-3">${esc(p.problem)}</p>
          ${badgeOf(p)}
          <div class="cine-actions">
            <button class="cta" data-open>${t('intoStory')} ${IC.icon('arrow', 'cta-ic')}</button>
          </div>
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
            <span class="hub-thumb">${url ? `<img src="${esc(url)}" alt="" loading="lazy"/>` : `<span class="hub-thumb-ic">${IC.series(s.id)}</span>`}</span>
            <span class="hub-body"><b>${IC.series(s.id, 'inline-ic')}${esc(x.title)}</b><small>${esc(x.question)}</small></span>
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
            <span class="nl-meta">${p ? `${IC.product(p.key, 'inline-ic')}${esc(p.name)}` : ''} · ${esc(n.version || '')} · ${esc(fmtDate(n.date))}</span>
            <b>${esc(n.title)}</b>
            <span class="nl-open">${t('read')} ${IC.icon('arrow', 'cta-ic')}</span>
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

/* ---------- 전체 지도(영향 흐름) ----------
 * 3단 흐름: [이야기 시리즈] → ◎ AramLens → [서비스]. 왼쪽은 내가 겪은 시리즈,
 * 오른쪽은 그 이야기가 자라 만들어진 서비스. 평소엔 은은한 실선만 이어져 있고,
 * 서비스에 마우스를 올리면 그것을 '태어나게 한' 시리즈 실선이 점등되고 관련
 * 이야기 칩이 떠오른다(점진적 공개). 칩·노드를 클릭하면 그 가지로 줌인한다. */
function buildOverview(tr) {
  const products = DB.products || [];

  // 제품이 뿌리로 삼은 스토리들이 속한 시리즈(중복 제거, DB.series 순서 유지)
  const seriesIdsOfProduct = (p) => {
    const set = new Set();
    storiesOfProduct(p).forEach(cid => { const s = seriesOfContent(cid); if (s) set.add(s.id); });
    return set;
  };
  const prodSeries = {};            // key → Set(seriesId)  (제품을 키운 시리즈)
  const seriesProds = {};           // seriesId → [key]     (시리즈가 키운 제품)
  products.forEach(p => {
    const sset = seriesIdsOfProduct(p);
    prodSeries[p.key] = sset;
    sset.forEach(sid => { (seriesProds[sid] = seriesProds[sid] || []).push(p.key); });
  });
  const originSeries = (DB.series || []).filter(s => seriesProds[s.id]);   // 서비스를 키운 시리즈만

  // 제품이 실제로 태어난 '읽을 수 있는' 이야기 칩(계획 글 제외)
  const chipsOfProduct = (p) => storiesOfProduct(p).map(contentOf).filter(c => c && !isPlanned(c));

  // 세로 균등 분포(%). 상·하단 HUD(브랜드·nav·위치·힌트)와 우측 레일을 피해
  // 좌우 열은 안쪽(20% / 78%)으로 당기고, 세로 밴드도 안전 구간으로 좁힌다.
  const vspread = (i, n, top, bottom) => n <= 1 ? (top + bottom) / 2 : top + (bottom - top) * i / (n - 1);
  const cx = 50, cy = 44, leftX = 20, rightX = 78;
  const center = { x: cx, y: cy };
  const seriesNodes = originSeries.map((s, i) => ({ s, id: s.id, x: leftX, y: vspread(i, originSeries.length, 17, 66) }));
  const prodNodes = products.map((raw, i) => ({ raw, key: raw.key, x: rightX, y: vspread(i, products.length, 30, 60) }));

  // 연결선: 시리즈→중심(왼쪽 반) · 중심→서비스(오른쪽 반)
  const line = (a, b, cls, data = '') => `<line class="map-edge ${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${data}/>`;
  const edges = [
    ...seriesNodes.map(n => line(n, center, 'branch', `data-src-series="${n.id}"`)),
    ...prodNodes.map(n => line(center, n, 'trunk', `data-dst-prod="${n.key}"`)),
  ].join('');

  const nodeBtn = (n, cls, inner, data) =>
    `<button class="map-node ${cls}" style="left:${n.x}%;top:${n.y}%" ${data}>${inner}</button>`;

  const seriesMarkup = seriesNodes.map(n => {
    const x = sTr(n.s);
    const fed = seriesProds[n.id] || [];
    return nodeBtn(n, 'is-series', `
      <span class="map-node-ic">${IC.series(n.id)}</span>
      <span class="map-node-label">${esc(x.title)}</span>
      <span class="map-node-sub">${fed.length} ${t('mapColServices').toLowerCase()}</span>`,
      `data-series="${n.id}"`);
  }).join('');

  const prodMarkup = prodNodes.map(n => {
    const p = pTr(n.raw);
    const chips = chipsOfProduct(n.raw);
    const shown = chips.slice(0, 6);
    const chipHtml = shown.map(c => {
      const s = seriesOfContent(c.id);
      return `<button class="map-chip" data-article="${c.id}" style="--si:${shown.indexOf(c)}">${IC.series(s ? s.id : '', 'chip-ic')}<span>${esc(cTitle(c))}</span></button>`;
    }).join('');
    const more = chips.length > shown.length ? `<span class="map-chip more">+${chips.length - shown.length}</span>` : '';
    return `
      ${nodeBtn(n, 'is-product', `
        <span class="map-node-ic">${IC.product(p.key)}</span>
        <span class="map-node-label">${esc(p.name)}</span>
        <span class="map-node-sub">${esc(p.tagline)}</span>`, `data-product="${p.key}"`)}
      <div class="map-chips" data-chips="${p.key}" style="left:${rightX}%;top:${n.y}%">
        <span class="map-chips-head">${IC.product(p.key, 'chips-head-ic')}${esc(p.name)} · ${chips.length} ${t('mapStoriesLabel')}</span>
        ${chipHtml}${more}
      </div>`;
  }).join('');

  const el = addScene(tr, t('overviewTrack'), 'sc-overview', `
    <div class="map-wrap">
      <span class="map-col-head left">${t('mapColSeries')}</span>
      <span class="map-col-head right">${t('mapColServices')}</span>
      <svg class="map-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${edges}</svg>
      ${seriesMarkup}
      ${nodeBtn(center, 'is-core', `
        <span class="map-core-mark">${IC.icon('lens')}</span>
        <span class="map-core-title">AramLens</span>
        <span class="map-core-sub">AI · DATA · YOUTH SPORTS</span>`, 'data-core')}
      ${prodMarkup}
    </div>
    <div class="map-legend">
      ${kicker(t('overviewKicker'))}
      <h2 class="display sm">${t('overviewTitle')}</h2>
      <p class="lead">${t('overviewLead')}</p>
    </div>`);

  /* --- 점진적 공개: 호버 시 흐름 실선 점등 + 이야기 칩 노출 --- */
  const wrap = el.querySelector('.map-wrap');
  const edgeEls = [...el.querySelectorAll('.map-edge')];
  const seriesEls = [...el.querySelectorAll('[data-series]')];
  const prodEls = [...el.querySelectorAll('[data-product]')];
  const chipBoxes = [...el.querySelectorAll('.map-chips')];

  const clearTrace = () => {
    wrap.classList.remove('tracing');
    edgeEls.forEach(e => e.classList.remove('lit', 'dim'));
    seriesEls.forEach(e => e.classList.remove('lit', 'dim'));
    prodEls.forEach(e => e.classList.remove('lit', 'dim'));
    chipBoxes.forEach(b => b.classList.remove('show'));
  };

  const traceProduct = (key) => {
    const sset = prodSeries[key] || new Set();
    wrap.classList.add('tracing');
    edgeEls.forEach(e => {
      const lit = e.dataset.dstProd === key || (e.dataset.srcSeries && sset.has(e.dataset.srcSeries));
      e.classList.toggle('lit', lit); e.classList.toggle('dim', !lit);
    });
    seriesEls.forEach(e => {
      const lit = sset.has(e.dataset.series);
      e.classList.toggle('lit', lit); e.classList.toggle('dim', !lit);
    });
    prodEls.forEach(e => {
      const lit = e.dataset.product === key;
      e.classList.toggle('lit', lit); e.classList.toggle('dim', !lit);
    });
    chipBoxes.forEach(b => b.classList.toggle('show', b.dataset.chips === key));
  };

  const traceSeries = (sid) => {
    const fed = new Set(seriesProds[sid] || []);
    wrap.classList.add('tracing');
    edgeEls.forEach(e => {
      const lit = e.dataset.srcSeries === sid || (e.dataset.dstProd && fed.has(e.dataset.dstProd));
      e.classList.toggle('lit', lit); e.classList.toggle('dim', !lit);
    });
    seriesEls.forEach(e => {
      const lit = e.dataset.series === sid;
      e.classList.toggle('lit', lit); e.classList.toggle('dim', !lit);
    });
    prodEls.forEach(e => {
      const lit = fed.has(e.dataset.product);
      e.classList.toggle('lit', lit); e.classList.toggle('dim', !lit);
    });
  };

  prodEls.forEach(n => {
    const key = n.dataset.product;
    n.addEventListener('mouseenter', () => traceProduct(key));
    n.addEventListener('focus', () => traceProduct(key));
    n.addEventListener('mouseleave', clearTrace);
    n.addEventListener('blur', clearTrace);
    n.addEventListener('click', () => diveTo(() => {
      goRow(homeRowOfProduct(key));
      pushTrack('p:' + key, x => buildProduct(x, productOf(key)));
    }));
  });
  seriesEls.forEach(n => {
    const sid = n.dataset.series;
    n.addEventListener('mouseenter', () => traceSeries(sid));
    n.addEventListener('focus', () => traceSeries(sid));
    n.addEventListener('mouseleave', clearTrace);
    n.addEventListener('blur', clearTrace);
    n.addEventListener('click', () => diveTo(() => { goRow(HOME_STORIES_ROW()); pushSeries(sid); }));
  });
  // 칩(이야기)을 클릭하면 그 글로 다이브. 칩 위에선 흐름을 유지한다.
  chipBoxes.forEach(box => {
    const key = box.dataset.chips;
    box.addEventListener('mouseenter', () => traceProduct(key));
    box.addEventListener('mouseleave', clearTrace);
    box.querySelectorAll('[data-article]').forEach(c =>
      c.addEventListener('click', (ev) => { ev.stopPropagation(); diveTo(() => openArticleDeep(c.dataset.article)); }));
  });
  el.querySelector('[data-core]').addEventListener('click', () => diveTo(() => resetHome(0)));
}

/* 지도에서 가지로 다이브: 홈 트랙을 기준으로 다시 세운 뒤 동작 실행 */
function diveTo(fn) {
  navStack = [{ track: getTrack('home', buildHome), row: 0 }];
  fn();
}

/* Map 버튼: 어디서든 전체 지도로 줌아웃 */
function openOverview() {
  if (current() && current().track.key === 'overview') { diveTo(() => resetHome(0)); return; }
  navStack = [{ track: getTrack('overview', buildOverview), row: 0 }];
  activate();
}

/* ---------- 서비스 트랙 ---------- */
function buildProduct(tr, raw) {
  const p = pTr(raw);

  /* 0 — 히어로 (풀블리드) */
  addScene(tr, LANG === 'en' ? `${p.name} — Opening` : `${p.name} — 시작`, 'sc-hero sc-p-hero cine', `
    ${bgArt(artOf(p.key, 'hero'), 'cine-bg')}
    <div class="inner center cine-inner">
      <div class="cine-block">
        ${kicker(t('storyKicker'))}
        <h1 class="display prod-name center-name">${IC.product(p.key, 'title-ic')}${esc(p.name)}</h1>
        <p class="tagline">${esc(p.tagline)}</p>
        ${badgeOf(p)}
        <p class="lead dim">${t('scrollNote')}</p>
      </div>
    </div>
    ${cue}`,
    () => goRow(1));

  /* 1 — 문제 (풀블리드 · 좌하단 오버레이) */
  addScene(tr, LANG === 'en' ? 'The problem' : '풀려는 문제', 'sc-narr cine', `
    ${bgArt(artOf(p.key, 'problem'), 'cine-bg')}
    <div class="inner cine-inner">
      <div class="cine-block">
        ${kicker(tc(p.key, 'ch1Kicker'))}
        <h2 class="display sm">${tc(p.key, 'ch1Title')}</h2>
        ${tc(p.key, 'ch1Lead') ? `<p class="lead" style="color:var(--accent-2)">${tc(p.key, 'ch1Lead')}</p>` : ''}
        <p class="lead">${esc(p.problem)}</p>
      </div>
    </div>
    ${cue}`,
    () => goRow(2));

  /* 2 — 기원 (풀블리드 · 우측 정렬) */
  addScene(tr, LANG === 'en' ? 'The origin' : '누가, 왜 만들었나', 'sc-narr cine', `
    ${bgArt(artOf(p.key, 'origin'), 'cine-bg')}
    <div class="inner cine-inner right">
      <div class="cine-block">
        ${kicker(tc(p.key, 'ch2Kicker'))}
        <h2 class="display sm">${tc(p.key, 'ch2Title')}</h2>
        ${tc(p.key, 'ch2Lead') ? `<p class="lead" style="color:var(--accent-2)">${tc(p.key, 'ch2Lead')}</p>` : ''}
        <p class="lead">${esc(p.origin)}</p>
      </div>
    </div>
    ${cue}`,
    () => goRow(3));

  /* 3..N — 기능 (풀블리드 배경 + 스토리 카드) */
  (p.features || []).forEach((f, i) => {
    const readable = (f.stories || []).map(contentOf).filter(c => c && !isPlanned(c));
    const primary = readable.length ? () => pushArticle(readable[0].id) : null;
    const stories = (f.stories || []).map(cid => {
      const c = contentOf(cid);
      if (!c) return '';
      return isPlanned(c)
        ? `<span class="story-link locked">${IC.icon('lock', 'link-ic')}<span class="link-body">${esc(cTitle(c))}<small>${esc(publishLabel(c))}</small></span></span>`
        : `<button class="story-link" data-article="${cid}">${IC.series(seriesOfContent(cid) ? seriesOfContent(cid).id : '', 'link-ic')}<span class="link-body">${esc(cTitle(c))}<small>${t('readStory')} ${IC.icon('arrow', 'cta-ic')}</small></span></button>`;
    }).join('');
    const el = addScene(tr, `${LANG === 'en' ? 'Feature' : '기능'} ${i + 1} — ${f.name}`, 'sc-feat cine', `
      ${bgArt(artOf(p.key, i % 2 ? 'origin' : 'problem'), 'cine-bg dim2')}
      <div class="inner cine-inner">
        <div class="cine-block feat-block">
          <span class="giant-num soft">F${i + 1}</span>
          ${kicker(`${t('featureKicker')} · ${String(i + 1).padStart(2, '0')} / ${String(p.features.length).padStart(2, '0')}`)}
          <h2 class="display sm">${esc(f.name)}</h2>
          <p class="lead">${esc(f.desc)}</p>
          <div class="story-panel">
            <p class="story-panel-head">${IC.icon('spark', 'head-ic')}${t('storyBehind')}</p>
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
  const related = relatedProducts(p.key);       // 마인드맵: 이야기를 공유하는 다른 서비스
  const ctaEl = addScene(tr, LANG === 'en' ? 'Join the story' : '함께하기', 'sc-cta cine', `
    ${bgArt(artOf(p.key, 'hero'), 'cine-bg dim2')}
    <div class="inner center cine-inner">
      <div class="cine-block">
        ${kicker(t('joinKicker'))}
        <h2 class="display sm">${t('joinTitle')}</h2>
        <ul class="who-list">${(p.forWho || []).map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        <div class="cta-row">
          <a class="cta ghosted" href="${esc(p.repo)}" target="_blank" rel="noopener">${IC.icon('github', 'cta-ic')}${t('ctaGithub')}</a>
          ${p.site
            ? `<a class="cta" href="${esc(p.site)}" target="_blank" rel="noopener">${IC.icon('play', 'cta-ic')}${t('ctaUse')}</a>`
            : `<span class="cta soon">${IC.icon('spark', 'cta-ic')}${t('ctaSoon')}</span>`}
          ${(p.links || []).map(l => `<a class="cta ghosted" href="${esc(l.url)}" target="_blank" rel="noopener">${IC.icon('link', 'cta-ic')}${esc(l.label)}</a>`).join('')}
        </div>
        ${related.length ? `<div class="related-services">
          <p class="related-head">${IC.icon('link', 'head-ic')}${t('relatedService')}</p>
          <div class="related-row">${related.map(rp => {
            const rx = pTr(rp);
            return `<button class="related-chip" data-product="${rp.key}">${IC.product(rp.key, 'inline-ic')}${esc(rx.name)} ${IC.icon('arrow', 'cta-ic')}</button>`;
          }).join('')}</div>
        </div>` : ''}
        ${nls.length ? `<div class="nl-list narrow">${nls.map(n => `
          <button class="nl-card" data-nl="${n.id}">
            <span class="nl-meta">${esc(n.version || '')} · ${esc(fmtDate(n.date))}</span>
            <b>${esc(n.title)}</b><span class="nl-open">${t('read')} ${IC.icon('arrow', 'cta-ic')}</span>
          </button>`).join('')}</div>` : ''}
      </div>
    </div>`,
    () => window.open(p.site || p.repo, '_blank'));
  ctaEl.querySelectorAll('[data-nl]').forEach(n =>
    n.addEventListener('click', () => {
      const nl = nls.find(x => x.id === n.dataset.nl);
      pushTrack('nl:' + nl.id, x => buildNewsletter(x, nl));
    }));
  // 마인드맵 점프: 같은 이야기를 공유하는 다른 서비스로 (서비스↔서비스)
  ctaEl.querySelectorAll('[data-product]').forEach(n =>
    n.addEventListener('click', () => {
      const key = n.dataset.product;
      // 같은 깊이(col 1)로 갈아타기: 현재 서비스 트랙을 pop 후 대상 서비스 push
      if (current().track.key.startsWith('p:')) navStack.pop();
      goRow(homeRowOfProduct(key));
      pushTrack('p:' + key, x => buildProduct(x, productOf(key)));
    }));
}

/* ---------- 시리즈 트랙 ---------- */
function pushSeries(sid) {
  pushTrack('s:' + sid, tr => {
    const s = seriesOf(sid);
    const x = sTr(s);
    const url = coverUrl(s);
    const readable = s.articles.map(contentOf).filter(c => c && !isPlanned(c));
    const el = addScene(tr, x.title, 'sc-series cine', `
      ${url ? bgArt(url, 'cine-bg dim2') : ''}
      <div class="inner cine-inner">
        <div class="cine-block wide">
          ${kicker(t('seriesKicker'))}
          <h2 class="display sm">${IC.series(s.id, 'title-ic')}${esc(x.title)}</h2>
          <p class="lead">${esc(x.question)}</p>
          <div class="scroll-area ep-list">
            ${s.articles.map((cid, i) => {
              const c = contentOf(cid);
              return isPlanned(c)
                ? `<span class="ep locked"><span class="ep-num">${String(i + 1).padStart(2, '0')}</span><b>${esc(cTitle(c))}</b><small>${IC.icon('lock', 'cta-ic')}${esc(publishLabel(c))}</small></span>`
                : `<button class="ep" data-article="${cid}"><span class="ep-num">${String(i + 1).padStart(2, '0')}</span><b>${esc(cTitle(c))}</b><small>${t('read')} ${IC.icon('arrow', 'cta-ic')}</small></button>`;
            }).join('')}
          </div>
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
        <div class="reading-col">
          ${kicker(s ? `${IC.series(s.id, 'title-ic')}${esc(sx.title)}` : t('seriesKicker'))}
          <h1 class="display sm article-title">${esc(cTitle(c))}</h1>
          ${LANG === 'en' ? `<p class="lang-note">${t('koreanNote')}</p>` : ''}
          <div class="article-body"><p class="dim">${t('loading')}</p></div>
        </div>
      </div>`,
      next);
    loadMarkdown(el.querySelector('.article-body'), c.file, cid, tr);
  });
}

function buildNewsletter(tr, nl) {
  const el = addScene(tr, nl.title, 'sc-article', `
    <div class="inner reading scroll-area">
      <div class="reading-col">
        ${kicker(t('nlKicker'))}
        <div class="article-body"><p class="dim">${t('loading')}</p></div>
      </div>
    </div>`);
  loadMarkdown(el.querySelector('.article-body'), nl.file, null, tr);
}

/* 퍼즐 개념 폐기: md 원문은 그대로 두고 렌더 직전에 '조각/퍼즐' 표현만 정리한다.
 *  - `## 🧩 조각 3 — 제목`  → `## 제목`
 *  - `` `퍼즐 3조각` `` 같은 조각 수 메타 인라인 코드 제거
 *  - `**다음 퍼즐 →** [..]` → `**다음 이야기 →** [..]`
 *  - 남은 '다음 퍼즐'/'퍼즐 N' 잔여 표현도 '다음 이야기'/'이야기 N'로 */
function depuzzle(md) {
  return md
    // `## 🧩 조각 N — 제목` → `## 제목`
    .replace(/^(#{1,6})\s*🧩\s*조각\s*\d+\s*[—–-]\s*/gm, '$1 ')
    // 조각 수 메타 인라인 코드(앞뒤 ' · ' 구분자까지) 제거
    .replace(/\s*·\s*`\s*퍼즐?\s*\d+\s*조각\s*`/g, '')
    .replace(/`\s*퍼즐?\s*\d+\s*조각\s*`\s*·\s*/g, '')
    .replace(/`\s*퍼즐?\s*\d+\s*조각\s*`/g, '')
    // 남은 '퍼즐' 표현을 '이야기'로 정리 (구체적 → 일반 순서)
    .replace(/다음\s*퍼즐/g, '다음 이야기')
    .replace(/퍼즐\s*완성/g, '이야기 완성')
    .replace(/퍼즐\s*스토리/g, '이야기')
    .replace(/퍼즐\s*(\d+)/g, '이야기 $1')
    .replace(/퍼즐의/g, '이야기의')
    .replace(/퍼즐/g, '이야기');
}

async function loadMarkdown(bodyEl, file, cid, tr) {
  try {
    const md = await fetch(withVer(file)).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
    const body = depuzzle(md.replace(/^\s*---\s*\n[\s\S]*?\n---\s*\n?/, ''));
    bodyEl.innerHTML = marked.parse(body);
    // 장면 헤더에 이미 제목을 크게 얹었으므로 본문 첫 H1은 숨긴다 (제목 중복 방지)
    if (cid) { const h1 = bodyEl.querySelector('h1'); if (h1) h1.remove(); }
    // 오른쪽 퀵 이동용: 본문 소제목(H2)을 이 트랙의 목차(sections)로 수집 + 앵커 부여
    if (tr) {
      const scroller = bodyEl.closest('.scroll-area');
      tr.sections = [...bodyEl.querySelectorAll('h2')].map((h, i) => {
        h.id = `sec-${i}`;
        return { id: h.id, title: h.textContent.trim(), el: h };
      });
      tr.scroller = scroller || null;
      if (tr.sections.length) { renderRail(); attachScrollSpy(tr); }
    }
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
        div.innerHTML = `<p class="story-panel-head">${IC.icon('spark', 'head-ic')}${t('bornFrom')}</p>` + born.map(({ p, feats }) => {
          const px = pTr(p);
          return `<button class="story-link" data-product="${p.key}">${IC.product(p.key, 'link-ic')}<span class="link-body">${esc(p.name)} — ${feats.map((f, i) => {
            const fi = p.features.indexOf(f);
            return esc((px.features[fi] || f).name);
          }).join(' · ')}<small>${t('seeService')} ${IC.icon('arrow', 'cta-ic')}</small></span></button>`;
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
  if (now - wheelLock < 680 || Math.abs(e.deltaY) < 12) return;
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

function escapeAction() {
  // 전체 지도에선 Esc가 홈으로 다이브(줌인). 홈 루트에선 Esc가 지도로 줌아웃.
  // 그 밖에는 이전 깊이로.
  const cur = current();
  if (cur && cur.track.key === 'overview') { diveTo(() => resetHome(0)); return; }
  if (navStack.length <= 1) { openOverview(); return; }
  popTrack();
}

// 글 트랙의 스크롤러(전체 화면 리딩 영역) — 있으면 상하 키/스크롤이 여기에 걸린다
function articleScroller() {
  const cur = current();
  return cur && cur.track.scroller ? cur.track.scroller : null;
}

window.addEventListener('keydown', (e) => {
  // 포커스된 버튼/링크의 Enter는 그 요소의 클릭에 맡긴다 (이중 동작 방지)
  if (e.key === 'Enter' && e.target.closest && e.target.closest('button, a')) return;
  const onMap = current() && current().track.key === 'overview';
  if (e.key === 'Escape' || e.key === 'ArrowLeft') { e.preventDefault(); escapeAction(); return; }
  if (onMap) return; // 지도에선 상하 스크롤 없음 (노드 클릭·Esc만)
  // 글 화면에선 상하/PageUp·Down·Space를 리딩 영역 스크롤에 쓴다 (씬 이동 대신)
  const sc = articleScroller();
  if (sc && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp' || e.key === ' ')) {
    e.preventDefault();
    const page = sc.clientHeight * 0.9, line = sc.clientHeight * 0.16;
    const d = e.key === 'PageDown' || e.key === ' ' ? page : e.key === 'PageUp' ? -page : e.key === 'ArrowDown' ? line : -line;
    sc.scrollBy({ top: d, behavior: 'smooth' });
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); goRow(current().row + 1); }
  else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goRow(current().row - 1); }
  else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); goPrimary(); }
  else if (e.key === 'Home') resetHome(0);
});

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-next]')) goRow(current().row + 1);
});
backBtn.addEventListener('click', escapeAction);
document.getElementById('nav-map').addEventListener('click', openOverview);
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
