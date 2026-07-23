/* 프레지(Prezi)식 무한 캔버스 SPA.
 *
 * 모든 화면은 거대한 캔버스(#canvas) 위의 '장면(.scene)'이고, 카메라(transform)가
 * 줌아웃→이동→줌인으로 날아다닌다. 구조는 트랙(track) = 세로 장면 시퀀스:
 *
 *   홈 트랙(col 0)      : 인트로 → 서비스 홍보 ×3 → 이야기 허브 → 뉴스레터   (스크롤 ↓)
 *   서비스 트랙(col 1)   : 히어로 → 문제 → 기원 → 기능 ×N → CTA              (클릭 시 → 오른쪽)
 *   글/시리즈 트랙(col 2): 더 깊은 관심 — 기능이 태어난 이야기(md)             (더 오른쪽)
 *
 * 세로 = 서사의 진행, 가로(오른쪽) = 관심의 깊이. 뒤로가기는 왼쪽으로 돌아온다.
 * 우측 대시 레일: 현재 트랙의 장면 수만큼 -가 쌓이고, 호버하면 목차가 열려 점프한다.
 * 데이터 원천은 data/contents.json (tools/build_contents.py 산출물) 하나다. */

const stage = document.getElementById('stage');
const canvas = document.getElementById('canvas');
const railEl = document.getElementById('rail');
const railDashes = document.getElementById('rail-dashes');
const railPanel = document.getElementById('rail-panel');
const hudLoc = document.getElementById('hud-loc');
const hudHint = document.getElementById('hud-hint');
const backBtn = document.getElementById('nav-back');

let DB = null;

const VER = (window.BUILD_VERSION && !window.BUILD_VERSION.startsWith('__')) ? window.BUILD_VERSION : 'dev';
const withVer = (url) => `${url}${url.includes('?') ? '&' : '?'}v=${VER}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const contentOf = (id) => DB.contents.find(c => c.id === id);
const seriesOf = (id) => DB.series.find(s => s.id === id);
const seriesOfContent = (cid) => DB.series.find(s => s.articles.includes(cid));
const productOf = (key) => (DB.products || []).find(p => p.key === key);
const productsOfStory = (cid) => (DB.products || [])
  .map(p => ({ p, feats: (p.features || []).filter(f => (f.stories || []).includes(cid)) }))
  .filter(x => x.feats.length);
const isPlanned = (c) => !!c && c.status === 'planned';
const fmtDate = (s) => {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || ''));
  return m ? `${m[1]}년 ${+m[2]}월 ${+m[3]}일` : String(s || '');
};
const publishLabel = (c) => (c && c.publish) ? `${fmtDate(c.publish)} 공개 예정` : '작성 중 · 공개 예정';
const coverUrl = (s) => (s && s.hasCover !== false) ? `${s.coverBase}${s.sexed ? '_M' : ''}.jpg` : null;

/* 서비스별 장면 배경 아트 — 퍼즐 커버 사진을 재사용한다 */
const ART = {
  home: 'content/swimmer/first-lane/cover.jpg',
  stories: 'content/builder/data-to-ai/cover.jpg',
  swimvault: { hero: 'content/swimmer/american-lanes/cover.jpg', problem: 'content/swimmer/first-lane/cover.jpg', origin: 'content/dreamer/pacific-bridge/cover.jpg' },
  splitlane: { hero: 'content/swimmer/race-craft/cover.jpg', problem: 'content/swimmer/champion-code/cover_M.jpg', origin: 'content/builder/builder-origin/cover.jpg' },
  'swim-meets': { hero: 'content/parent/away-meets/cover.jpg', problem: 'content/parent/parent-seasons/cover.jpg', origin: 'content/builder/data-to-ai/cover.jpg' },
};
const artOf = (key, kind) => (ART[key] && ART[key][kind]) || ART.home;

/* ---------- 캔버스 좌표계 ----------
 * 장면 크기 = 뷰포트. 가로 간격 GX(관심의 깊이), 세로 간격 GY(서사의 진행). */
let VW = window.innerWidth, VH = window.innerHeight;
const GX = () => VW * 1.3;
const GY = () => VH * 1.22;

const tracks = new Map(); // key → track
let navStack = [];        // [{track, row}] — 마지막이 현재 위치

function trackBaseY(t) { return t.parent ? trackBaseY(t.parent) + t.entryRow * GY() : 0; }
function scenePos(t, row) { return { x: t.col * GX(), y: trackBaseY(t) + row * GY() }; }

function getTrack(key, builder) {
  if (tracks.has(key)) return tracks.get(key);
  const cur = navStack[navStack.length - 1];
  const t = {
    key,
    col: cur ? cur.track.col + 1 : 0,
    parent: cur ? cur.track : null,
    entryRow: cur ? cur.row : 0,
    scenes: [],
    visited: new Set(),
  };
  tracks.set(key, t);
  builder(t);
  layoutTrack(t);
  return t;
}

function addScene(t, title, cls, html) {
  const el = document.createElement('section');
  el.className = `scene ${cls}`;
  el.innerHTML = html;
  canvas.appendChild(el);
  t.scenes.push({ title, el, row: t.scenes.length });
  return el;
}

function layoutTrack(t) {
  t.scenes.forEach(sc => {
    const p = scenePos(t, sc.row);
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

/* ---------- 카메라 ---------- */
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
  const dur = Math.min(1500, 550 + dist * 0.18);
  // 먼 비행일수록 중간에 줌아웃해 '캔버스 위를 난다'는 감각을 준다
  const midS = dist > VW * 0.7 ? 0.45 : dist > VW * 0.25 ? 0.8 : 0.96;
  const mid = { x: (from.x + x) / 2, y: (from.y + y) / 2 };
  flying = canvas.animate([
    { transform: tf(from) },
    { transform: tf(mid, midS), offset: 0.5 },
    { transform: tf(cam) },
  ], { duration: dur, easing: 'cubic-bezier(.6,.05,.3,1)' });
  flying.onfinish = () => { flying = null; };
}

/* ---------- 내비게이션 ---------- */
function current() { return navStack[navStack.length - 1]; }

function activate() {
  const cur = current();
  const t = cur.track;
  t.visited.add(cur.row);
  // 현재 스택에 속한 트랙만 보이게 — 같은 좌표대의 다른 트랙과 겹치지 않도록
  const live = new Set(navStack.map(e => e.track));
  tracks.forEach(tr => tr.scenes.forEach(sc => {
    sc.el.classList.toggle('offstage', !live.has(tr));
    sc.el.classList.toggle('active', tr === t && sc.row === cur.row);
  }));
  const p = scenePos(t, cur.row);
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

function pushTrack(key, builder, row = 0) {
  const t = getTrack(key, builder);
  navStack.push({ track: t, row: Math.max(0, Math.min(row, t.scenes.length - 1)) });
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

/* ---------- HUD: 대시 레일 · 위치 · 힌트 ---------- */
function renderRail() {
  const cur = current();
  const t = cur.track;
  railDashes.innerHTML = t.scenes.map(sc => `
    <button class="rail-dash ${sc.row === cur.row ? 'on' : ''} ${t.visited.has(sc.row) ? 'seen' : ''}"
      data-row="${sc.row}" aria-label="${esc(sc.title)}"></button>`).join('');
  railPanel.innerHTML = `
    <p class="rail-panel-head">${esc(trackLabel(t))}</p>
    ${t.scenes.map(sc => `
      <button class="rail-item ${sc.row === cur.row ? 'on' : ''}" data-row="${sc.row}">
        <span class="rail-idx">${String(sc.row + 1).padStart(2, '0')}</span>${esc(sc.title)}
      </button>`).join('')}`;
  railEl.querySelectorAll('[data-row]').forEach(b =>
    b.addEventListener('click', () => goRow(+b.dataset.row)));
}

function trackLabel(t) {
  if (t.key === 'home') return '홈 — 서비스 이야기';
  if (t.key.startsWith('p:')) { const p = productOf(t.key.slice(2)); return p ? `${p.emoji} ${p.name}` : t.key; }
  if (t.key.startsWith('s:')) { const s = seriesOf(t.key.slice(2)); return s ? `${s.emoji} ${s.title}` : t.key; }
  if (t.key.startsWith('a:')) { const c = contentOf(t.key.slice(2)); return c ? c.title : t.key; }
  if (t.key.startsWith('nl:')) return '📮 뉴스레터';
  return t.key;
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
    ? (last ? '↑ 위로 — 서비스 이야기의 처음으로' : '스크롤 ↓ 다음 이야기 · 카드를 클릭하면 오른쪽으로 깊이 들어갑니다 →')
    : (last ? '↑ 위로 · ← 돌아가기(Esc)' : '스크롤 ↓ 서사가 이어집니다 · 관심 항목은 → 오른쪽으로');
}

/* ---------- 해시 라우팅 (딥링크·뒤로가기) ---------- */
function serialize() {
  const cur = current();
  const t = cur.track;
  if (t.key === 'home') return `#/h/${cur.row}`;
  if (t.key.startsWith('p:')) return `#/p/${t.key.slice(2)}/${cur.row}`;
  if (t.key.startsWith('s:')) return `#/s/${t.key.slice(2)}`;
  if (t.key.startsWith('a:')) return `#/a/${t.key.slice(2)}`;
  if (t.key.startsWith('nl:')) return `#/nl/${t.key.slice(2)}`;
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
    pushTrack('p:' + a, t => buildProduct(t, productOf(a)), Math.max(0, +b || 0));
    return;
  }
  if (kind === 's' && seriesOf(a)) { goRow(HOME_STORIES_ROW()); pushSeries(a); return; }
  if ((kind === 'a' || kind === 'c') && contentOf(a)) { openArticleDeep(a); return; }
  if (kind === 'nl' || kind === 'n') {
    goRow(HOME_NL_ROW());
    const nl = (DB.newsletters || []).find(n => n.id === a);
    if (nl) pushTrack('nl:' + a, t => buildNewsletter(t, nl));
    return;
  }
  if (kind === 't') goRow(HOME_STORIES_ROW()); // 구 트랙 링크 → 이야기 허브
}
function openArticleDeep(cid) {
  // 딥링크로 글에 직행: 홈 → (제품 or 시리즈) → 글 스택을 재구성
  const born = productsOfStory(cid);
  if (born.length) {
    const key = born[0].p.key;
    goRow(homeRowOfProduct(key));
    pushTrack('p:' + key, t => buildProduct(t, productOf(key)));
  } else {
    const s = seriesOfContent(cid);
    goRow(HOME_STORIES_ROW());
    if (s) pushSeries(s.id);
  }
  pushArticle(cid);
}

/* ================================================================
 * 장면 빌더들
 * ================================================================ */
/* 홈 트랙 장면 배치: 0 인트로 → 1..N 서비스 → N+1 이야기 허브 → N+2 뉴스레터 */
const homeRowOfProduct = (key) => 1 + Math.max(0, (DB.products || []).findIndex(p => p.key === key));
const HOME_STORIES_ROW = () => 1 + (DB.products || []).length;
const HOME_NL_ROW = () => 2 + (DB.products || []).length;

const kicker = (txt) => `<p class="kicker">${esc(txt)}</p>`;
const cue = `<button class="scroll-cue" data-next aria-label="다음 장면">⌄</button>`;
const bgArt = (url, cls = '') => `<div class="scene-bg ${cls}" style="background-image:url('${esc(url)}')"></div><div class="scene-veil"></div>`;

function buildHome(t) {
  const nStories = DB.contents.length;
  const nSeries = DB.series.length;

  /* 장면 0 — 인트로 */
  addScene(t, '인트로 — 관중석의 질문', 'sc-hero', `
    ${bgArt(ART.home)}
    <div class="inner center">
      ${kicker('AI · DATA · YOUTH SPORTS')}
      <h1 class="display">관중석의 질문이,<br/><em>서비스</em>가 됩니다.</h1>
      <p class="lead">AI와 데이터로 운동하는 아이의 성장을 기록·분석하는 아빠 개발자.<br/>
      그가 만드는 서비스의 이야기를, 한 장면씩 내려가며 만나보세요.</p>
      <div class="stat-row">
        <span class="stat"><b>3</b>개의 서비스</span>
        <span class="stat"><b>${nSeries}</b>개의 퍼즐</span>
        <span class="stat"><b>${nStories}</b>편의 이야기</span>
      </div>
    </div>
    ${cue}`);

  /* 장면 1~3 — 서비스 홍보 (한 페이지 = 한 서비스) */
  (DB.products || []).forEach((p, i) => {
    const st = p.status === 'live'
      ? '<span class="badge live">🟢 지금 사용 가능</span>'
      : '<span class="badge building">🛠 GitHub에서 공개 개발 중</span>';
    const el = addScene(t, `${p.emoji} ${p.name}`, 'sc-promo', `
      <div class="inner split">
        <div class="split-text">
          <span class="giant-num">0${i + 1}</span>
          ${kicker('SERVICE')}
          <h2 class="display">${p.emoji} ${esc(p.name)}</h2>
          <p class="tagline">${esc(p.tagline)}</p>
          <p class="lead">${esc(p.problem)}</p>
          ${st}
          <button class="cta" data-open="${p.key}">서비스 이야기 속으로 <span class="arrow">→</span></button>
        </div>
        <div class="split-art" data-open="${p.key}" role="button" tabindex="0">
          <figure class="art-frame"><img src="${esc(artOf(p.key, 'hero'))}" alt="${esc(p.name)}" loading="lazy"/></figure>
          <span class="art-hint">클릭하면 오른쪽으로 →</span>
        </div>
      </div>
      ${cue}`);
    el.querySelectorAll(`[data-open]`).forEach(n =>
      n.addEventListener('click', () => pushTrack('p:' + p.key, tr => buildProduct(tr, p))));
  });

  /* 장면 4 — 이야기 허브 */
  const hub = addScene(t, '서비스가 태어난 이야기', 'sc-hub', `
    ${bgArt(ART.stories, 'faint')}
    <div class="inner">
      ${kicker('ORIGIN STORIES')}
      <h2 class="display">모든 기능에는<br/><em>이야기</em>가 있습니다.</h2>
      <p class="lead">기능은 그냥 만들지 않습니다 — 질문과 문제가 먼저고, 기능은 그 답입니다.</p>
      <div class="scroll-area hub-grid">
        ${DB.series.map(s => {
          const url = coverUrl(s);
          return `
          <button class="hub-card" data-series="${s.id}">
            <span class="hub-thumb">${url ? `<img src="${esc(url)}" alt="" loading="lazy"/>` : ''}</span>
            <span class="hub-body">
              <b>${s.emoji} ${esc(s.title)}</b>
              <small>${esc(s.question)}</small>
            </span>
          </button>`;
        }).join('')}
      </div>
    </div>
    ${cue}`);
  hub.querySelectorAll('[data-series]').forEach(n =>
    n.addEventListener('click', () => pushSeries(n.dataset.series)));

  /* 장면 5 — 뉴스레터 */
  const nls = DB.newsletters || [];
  const nlScene = addScene(t, '📮 뉴스레터', 'sc-nl', `
    <div class="inner">
      ${kicker('NEWSLETTER')}
      <h2 class="display">이야기가 기능이 되면,<br/><em>편지</em>로 알려드립니다.</h2>
      <p class="lead">앱 출시와 버전 업그레이드에 맞춰, 그 기능이 태어난 이야기를 요약해 발행합니다.</p>
      <div class="nl-list">
        ${nls.length ? nls.map(n => {
          const p = productOf(n.product);
          return `
          <button class="nl-card" data-nl="${n.id}">
            <span class="nl-meta">${p ? `${p.emoji} ${esc(p.name)}` : ''} · ${esc(n.version || '')} · ${esc(fmtDate(n.date))}</span>
            <b>${esc(n.title)}</b>
            <span class="nl-open">읽기 →</span>
          </button>`;
        }).join('') : '<p class="lead dim">첫 호를 준비하고 있습니다.</p>'}
      </div>
      <p class="foot-note">〰️ 데이터를 만들고, 선수를 키웁니다 — <a href="https://github.com/kyj5482" target="_blank" rel="noopener">GitHub @kyj5482</a></p>
    </div>`);
  nlScene.querySelectorAll('[data-nl]').forEach(n =>
    n.addEventListener('click', () => {
      const nl = nls.find(x => x.id === n.dataset.nl);
      pushTrack('nl:' + nl.id, tr => buildNewsletter(tr, nl));
    }));
}

/* ---------- 서비스 트랙: 히어로 → 문제 → 기원 → 기능 ×N → CTA ---------- */
function buildProduct(t, p) {
  const st = p.status === 'live'
    ? '<span class="badge live">🟢 지금 사용 가능</span>'
    : '<span class="badge building">🛠 GitHub에서 공개 개발 중</span>';

  addScene(t, `${p.name} — 시작`, 'sc-hero sc-p-hero', `
    ${bgArt(artOf(p.key, 'hero'))}
    <div class="inner center">
      ${kicker('SERVICE STORY')}
      <h1 class="display">${p.emoji} ${esc(p.name)}</h1>
      <p class="tagline">${esc(p.tagline)}</p>
      ${st}
      <p class="lead dim">아래로 — 이 서비스가 태어난 서사가 이어집니다.</p>
    </div>
    ${cue}`);

  addScene(t, '풀려는 문제', 'sc-narr', `
    <div class="inner split">
      <div class="split-text">
        ${kicker('CHAPTER 1 — 문제')}
        <h2 class="display sm">모든 서비스는<br/>불편에서 시작됐습니다.</h2>
        <blockquote class="big-quote">${esc(p.problem)}</blockquote>
      </div>
      <div class="split-art"><figure class="art-frame tilt"><img src="${esc(artOf(p.key, 'problem'))}" alt="" loading="lazy"/></figure></div>
    </div>
    ${cue}`);

  addScene(t, '누가, 왜 만들었나', 'sc-narr', `
    <div class="inner split rev">
      <div class="split-text">
        ${kicker('CHAPTER 2 — 기원')}
        <h2 class="display sm">누가, 왜<br/>만들었을까요?</h2>
        <p class="lead">${esc(p.origin)}</p>
      </div>
      <div class="split-art"><figure class="art-frame tilt-l"><img src="${esc(artOf(p.key, 'origin'))}" alt="" loading="lazy"/></figure></div>
    </div>
    ${cue}`);

  (p.features || []).forEach((f, i) => {
    const stories = (f.stories || []).map(cid => {
      const c = contentOf(cid);
      if (!c) return '';
      return isPlanned(c)
        ? `<span class="story-link locked">🔒 ${esc(c.title)}<small>${esc(publishLabel(c))}</small></span>`
        : `<button class="story-link" data-article="${cid}">📖 ${esc(c.title)}<small>이야기 읽기 →</small></button>`;
    }).join('');
    const el = addScene(t, `기능 ${i + 1} — ${f.name}`, 'sc-feat', `
      <div class="inner split">
        <div class="split-text">
          <span class="giant-num soft">F${i + 1}</span>
          ${kicker(`FEATURE ${i + 1} / ${p.features.length}`)}
          <h2 class="display sm">${esc(f.name)}</h2>
          <p class="lead">${esc(f.desc)}</p>
        </div>
        <div class="split-art">
          <div class="story-panel">
            <p class="story-panel-head">이 기능이 태어난 이야기</p>
            ${stories || '<p class="dim">연결된 이야기를 준비 중입니다.</p>'}
          </div>
        </div>
      </div>
      ${cue}`);
    el.querySelectorAll('[data-article]').forEach(n =>
      n.addEventListener('click', () => pushArticle(n.dataset.article)));
  });

  const nls = (DB.newsletters || []).filter(n => n.product === p.key);
  const ctaEl = addScene(t, '함께하기', 'sc-cta', `
    ${bgArt(artOf(p.key, 'hero'), 'faint')}
    <div class="inner center">
      ${kicker('JOIN THE STORY')}
      <h2 class="display sm">이런 분들과 함께<br/>만들어가고 싶습니다.</h2>
      <ul class="who-list">${(p.forWho || []).map(w => `<li>${esc(w)}</li>`).join('')}</ul>
      <div class="cta-row">
        <a class="cta ghosted" href="${esc(p.repo)}" target="_blank" rel="noopener">🐙 GitHub에서 함께 만들기</a>
        ${p.site
          ? `<a class="cta" href="${esc(p.site)}" target="_blank" rel="noopener">🚀 서비스 사용하기</a>`
          : `<span class="cta soon">🛠 출시 준비 중 — 뉴스레터로 소식을 받아보세요</span>`}
        ${(p.links || []).map(l => `<a class="cta ghosted" href="${esc(l.url)}" target="_blank" rel="noopener">🔗 ${esc(l.label)}</a>`).join('')}
      </div>
      ${nls.length ? `<div class="nl-list narrow">${nls.map(n => `
        <button class="nl-card" data-nl="${n.id}">
          <span class="nl-meta">${esc(n.version || '')} · ${esc(fmtDate(n.date))}</span>
          <b>${esc(n.title)}</b><span class="nl-open">읽기 →</span>
        </button>`).join('')}</div>` : ''}
    </div>`);
  ctaEl.querySelectorAll('[data-nl]').forEach(n =>
    n.addEventListener('click', () => {
      const nl = nls.find(x => x.id === n.dataset.nl);
      pushTrack('nl:' + nl.id, tr => buildNewsletter(tr, nl));
    }));
}

/* ---------- 시리즈 트랙(이야기 허브에서 진입): 퍼즐 한 판의 글 목록 ---------- */
function pushSeries(sid) {
  pushTrack('s:' + sid, t => {
    const s = seriesOf(sid);
    const url = coverUrl(s);
    const el = addScene(t, `${s.emoji} ${s.title}`, 'sc-series', `
      ${url ? bgArt(url, 'faint') : ''}
      <div class="inner">
        ${kicker('PUZZLE SERIES')}
        <h2 class="display sm">${s.emoji} ${esc(s.title)}</h2>
        <p class="lead">${esc(s.question)}</p>
        <div class="scroll-area ep-list">
          ${s.articles.map((cid, i) => {
            const c = contentOf(cid);
            return isPlanned(c)
              ? `<span class="ep locked"><span class="ep-num">${i + 1}</span><b>${esc(c.title)}</b><small>🔒 ${esc(publishLabel(c))}</small></span>`
              : `<button class="ep" data-article="${cid}"><span class="ep-num">${i + 1}</span><b>${esc(c.title)}</b><small>읽기 →</small></button>`;
          }).join('')}
        </div>
      </div>`);
    el.querySelectorAll('[data-article]').forEach(n =>
      n.addEventListener('click', () => pushArticle(n.dataset.article)));
  });
}

/* ---------- 글 트랙: md 본문 (가장 깊은 오른쪽) ---------- */
function pushArticle(cid) {
  pushTrack('a:' + cid, t => {
    const c = contentOf(cid);
    const el = addScene(t, c.title, 'sc-article', `
      <div class="inner">
        <article class="paper scroll-area"><p class="dim">이야기를 펼치는 중…</p></article>
      </div>`);
    loadMarkdown(el.querySelector('.paper'), c.file, cid);
  });
}

function buildNewsletter(t, nl) {
  const el = addScene(t, nl.title, 'sc-article', `
    <div class="inner">
      <article class="paper scroll-area"><p class="dim">불러오는 중…</p></article>
    </div>`);
  loadMarkdown(el.querySelector('.paper'), nl.file, null);
}

async function loadMarkdown(paperEl, file, cid) {
  try {
    const md = await fetch(withVer(file)).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
    const body = md.replace(/^\s*---\s*\n[\s\S]*?\n---\s*\n?/, '');
    paperEl.innerHTML = marked.parse(body);
    // 본문 속 상대 md 링크 → 캔버스 글 점프 (번호 프리픽스 무시, 슬러그 매칭)
    const slugKey = (path) => path.split('/').pop().replace(/\.md$/, '').replace(/^\d+-/, '');
    paperEl.querySelectorAll('a[href$=".md"]').forEach(a => {
      const target = DB.contents.find(x => slugKey(x.file) === slugKey(a.getAttribute('href')));
      if (target && !isPlanned(target)) {
        a.setAttribute('href', 'javascript:void 0');
        a.addEventListener('click', () => { navStack.pop(); pushArticle(target.id); });
      } else {
        const span = document.createElement('span'); span.textContent = a.textContent; a.replaceWith(span);
      }
    });
    // 이 이야기에서 태어난 기능 → 해당 서비스 트랙으로 (스택을 갈아타고 왼쪽으로 비행)
    if (cid) {
      const born = productsOfStory(cid);
      if (born.length) {
        const div = document.createElement('div');
        div.className = 'born-box';
        div.innerHTML = `<p class="story-panel-head">이 이야기에서 태어난 기능</p>` + born.map(({ p, feats }) => `
          <button class="story-link" data-product="${p.key}">${p.emoji} ${esc(p.name)} — ${feats.map(f => esc(f.name)).join(' · ')}<small>서비스 보러 가기 →</small></button>`).join('');
        paperEl.appendChild(div);
        div.querySelectorAll('[data-product]').forEach(n => n.addEventListener('click', () => {
          const key = n.dataset.product;
          resetHome(homeRowOfProduct(key));
          pushTrack('p:' + key, tr => buildProduct(tr, productOf(key)));
        }));
      }
    }
  } catch (e) {
    paperEl.innerHTML = '<p class="dim">이 글을 불러오지 못했습니다.</p>';
  }
}

/* ================================================================
 * 입력: 휠 / 키보드 / 터치 / 버튼
 * ================================================================ */
let wheelLock = 0;
function canScrollInside(el, dy) {
  const area = el && el.closest && el.closest('.scroll-area');
  if (!area) return false;
  if (dy > 0) return area.scrollTop + area.clientHeight < area.scrollHeight - 2;
  return area.scrollTop > 2;
}
stage.addEventListener('wheel', (e) => {
  if (canScrollInside(e.target, e.deltaY)) return; // 장면 내부 스크롤 우선
  e.preventDefault();
  const now = Date.now();
  if (now - wheelLock < 850 || Math.abs(e.deltaY) < 12) return;
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
  if (Math.abs(dx) > Math.abs(dy)) { if (dx < -70) popTrack(); return; } // 오른쪽 스와이프 = 뒤로
  if (Math.abs(dy) < 60) return;
  if (canScrollInside(e.target, dy)) return;
  goRow(current().row + (dy > 0 ? 1 : -1));
}, { passive: true });

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); goRow(current().row + 1); }
  else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goRow(current().row - 1); }
  else if (e.key === 'Escape' || e.key === 'ArrowLeft') popTrack();
  else if (e.key === 'Home') resetHome(0);
});

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-next]')) goRow(current().row + 1);
});
backBtn.addEventListener('click', popTrack);
document.getElementById('hud-brand').addEventListener('click', () => resetHome(0));

railEl.addEventListener('mouseenter', () => { railPanel.hidden = false; });
railEl.addEventListener('mouseleave', () => { railPanel.hidden = true; });

window.addEventListener('resize', () => {
  layoutAll();
  const cur = current();
  if (cur) { const p = scenePos(cur.track, cur.row); flyTo(p.x, p.y, { instant: true }); }
});

// 내부 이동이 만든 해시 변경은 serialize()와 일치하므로 무시된다 — 브라우저 뒤로가기만 라우팅
window.addEventListener('hashchange', () => { if (location.hash !== serialize()) routeFromHash(); });

/* ---------- 시작 ---------- */
(async function init() {
  DB = await fetch(withVer('data/contents.json')).then(r => r.json());
  routeFromHash();
})();
