/* SPA for GitHub Pages personal branding site.
 * Routes: #/ (홈: 제품+독자 선택) · #/t/<audience> (트랙) · #/s/<seriesId> (퍼즐 시리즈) · #/c/<contentId> (글)
 *         #/p/<productKey> (제품/브랜드) · #/n (뉴스레터 목록) · #/n/<newsletterId> (뉴스레터)
 * 독자 프로필(레벨/단계/관심사)은 localStorage에 저장되어 시리즈 활성화·맞춤 정렬에 사용된다.
 * 읽은 글(pb-read)은 시리즈 퍼즐의 조각 공개에 사용된다 — 글 하나 = 퍼즐 한 조각.
 * 테마 파라미터: ?theme=swim (수영: swimmer·parent·dreamer) / ?theme=dev (개발자: builder·dreamer). */

const app = document.getElementById('app');
let DB = null;      // contents.json (tools/build_contents.py가 폴더에서 생성)
let LEVELS = null;  // levels.json

/* ---------- 테마(주제) 필터 ---------- */
const THEMES = {
  swim: { audiences: ['swimmer', 'parent', 'dreamer'], label: '🏊 수영' },
  dev:  { audiences: ['builder', 'dreamer'], label: '💻 개발자' },
};
const themeKey = () => {
  const t = new URLSearchParams(location.search).get('theme');
  return THEMES[t] ? t : null;
};
const allowedAudiences = () => {
  const t = themeKey();
  return t ? THEMES[t].audiences : DB.audiences.map(a => a.key);
};
const isAllowed = (audKey) => allowedAudiences().includes(audKey);

const PROFILE_KEY = 'pb-profile';
const getProfile = () => JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
const setProfile = (patch) => {
  const p = { ...getProfile(), ...patch };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  return p;
};

/* ---------- 읽음(조각) 추적 ---------- */
const READ_KEY = 'pb-read';
const getRead = () => JSON.parse(localStorage.getItem(READ_KEY) || '{}');
const markRead = (id) => {
  const r = getRead();
  const isNew = !r[id];
  r[id] = Date.now();
  localStorage.setItem(READ_KEY, JSON.stringify(r));
  return isNew;
};

/* 캐시 버스팅: 배포 워크플로우가 index.html의 __BUILD_VERSION__을 커밋 해시로 치환. */
const VER = (window.BUILD_VERSION && !window.BUILD_VERSION.startsWith('__')) ? window.BUILD_VERSION : 'dev';
const withVer = (url) => `${url}${url.includes('?') ? '&' : '?'}v=${VER}`;

async function loadData() {
  if (DB && LEVELS) return;
  const [c, l] = await Promise.all([
    fetch(withVer('data/contents.json')).then(r => r.json()),
    fetch(withVer('data/levels.json')).then(r => r.json()),
  ]);
  DB = c; LEVELS = l;
}

const esc = (s) => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* ---------- 게시 예정(planned) 글 처리 ----------
 * status가 'planned'인 글은 아직 본문이 없다. 사이트에는 '게시 예정'으로 보여주되
 * 클릭(라우팅)은 막고, publish 날짜가 있으면 언제 열리는지 알려준다. */
const isPlanned = (c) => !!c && c.status === 'planned';
const fmtDate = (s) => {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || ''));
  return m ? `${m[1]}년 ${+m[2]}월 ${+m[3]}일` : String(s || '');
};
const publishLabel = (c) => (c && c.publish) ? `${fmtDate(c.publish)} 공개 예정` : '작성 중 · 공개 예정';
const audienceOf = (key) => DB.audiences.find(a => a.key === key);
/* ---------- 제품(브랜드) · 뉴스레터 ----------
 * products.json의 각 제품은 GitHub에서 개발 중인 앱 하나. feature.stories가 퍼즐 글 id를
 * 가리켜 '이 기능은 이 이야기에서 태어났다'를 보여준다 (스토리 → Feature 연결). */
const productOf = (key) => (DB.products || []).find(p => p.key === key);
const productsOfStory = (cid) => (DB.products || [])
  .map(p => ({ p, feats: (p.features || []).filter(f => (f.stories || []).includes(cid)) }))
  .filter(x => x.feats.length);
const newslettersOfProduct = (key) => (DB.newsletters || []).filter(n => n.product === key);
const PRODUCT_STATUS = {
  live: { label: '🟢 서비스 중', cls: 'live' },
  building: { label: '🛠 개발 중 · GitHub 공개', cls: 'building' },
};
const contentOf = (id) => DB.contents.find(c => c.id === id);
const seriesOf = (id) => DB.series.find(s => s.id === id);
const seriesOfContent = (contentId) => DB.series.find(s => s.articles.includes(contentId));

/* ---------- 시리즈 활성화 판정 ----------
 * 퍼즐(시리즈)은 프로필과 맞으면 "활성", 아니면 흐리게(비활성) 보인다.
 * swimmer: 온보딩에서 판정된 등급이 unlock.levels에 포함 · parent: 단계 · builder: 관심사.
 * unlock이 빈 객체면 항상 활성. 프로필이 없으면 '미정' — 온보딩 유도. */
function seriesState(s, profile) {
  const u = s.unlock || {};
  if (!u.levels && !u.stages && !u.interests) return 'active';
  if (s.audience === 'swimmer') {
    const lvl = profile.swimmer && profile.swimmer.level;
    if (!lvl) return 'unknown';
    return u.levels.includes(lvl) ? 'active' : 'dim';
  }
  if (s.audience === 'parent') {
    if (!profile.parentStage) return 'unknown';
    return u.stages.includes(profile.parentStage) ? 'active' : 'dim';
  }
  if (s.audience === 'builder') {
    if (!profile.builderInterest) return 'unknown';
    return u.interests.includes(profile.builderInterest) ? 'active' : 'dim';
  }
  return 'active';
}

function seriesProgress(s) {
  const read = getRead();
  const revealed = new Set();
  s.articles.forEach((id, i) => { if (read[id]) revealed.add(i); });
  return revealed;
}

/* ---------- 홈: 제품(브랜드) 3종 + 스토리(독자 선택) ----------
 * 이 사이트는 '이야기가 기능이 되는' 제품 홈페이지다.
 * 위: 개발 중인 앱 3개(브랜드) — 누가 왜 만들었는지의 기원 스토리로 소개.
 * 아래: 그 기원이 되는 퍼즐 스토리 트랙 — 독자가 자기 모습을 골라 들어간다. */
function productCardHTML(p) {
  const st = PRODUCT_STATUS[p.status] || PRODUCT_STATUS.building;
  const nStories = (p.features || []).reduce((n, f) => n + (f.stories || []).length, 0);
  return `
    <a class="product-card" href="#/p/${p.key}">
      <div class="product-head">
        <span class="product-emoji">${p.emoji}</span>
        <span class="product-status ${st.cls}">${st.label}</span>
      </div>
      <h3>${esc(p.name)}</h3>
      <p class="product-tagline">${esc(p.tagline)}</p>
      <p class="product-problem">${esc(p.problem)}</p>
      <span class="product-more">기원 스토리와 기능 ${nStories ? `· 연결된 이야기 ${nStories}편 ` : ''}→</span>
    </a>`;
}

function renderHome() {
  const t = themeKey();
  const heroTitle = t === 'swim'
    ? '두 수영 선수를 키우는 아빠의<br/>물살 위 성장 기록.'
    : t === 'dev'
    ? '차량 데이터 플랫폼을 만들어온<br/>20년차 엔지니어의 기록.'
    : 'AI와 데이터로, 운동하는 아이의<br/>성장을 기록·분석하는 아빠 개발자.';
  const nSeries = DB.series.filter(s => isAllowed(s.audience)).length;
  const products = DB.products || [];
  const latestNl = (DB.newsletters || [])[0];
  app.innerHTML = `
    <section class="hero">
      <h1>${heroTitle}</h1>
      <p>관중석에서 마주친 질문들이 이야기가 되고, 그 이야기가 앱의 기능이 됩니다.<br/>
      여기서 만드는 모든 서비스는 <strong>퍼즐 스토리</strong>에서 태어났습니다.</p>
    </section>
    ${products.length ? `
    <h2 class="section-label">만들고 있는 서비스</h2>
    <p class="reco-note">GitHub에서 공개 개발 중입니다. 각 기능이 어떤 이야기에서 태어났는지 함께 보세요.</p>
    <div class="product-grid">${products.map(productCardHTML).join('')}</div>` : ''}
    ${latestNl ? `
    <a class="nl-banner" href="#/n/${latestNl.id}">
      <span class="nl-badge">📮 뉴스레터</span>
      <span class="nl-banner-title">${esc(latestNl.title)}</span>
      <span class="nl-banner-more">전체 보기 →</span>
    </a>` : ''}
    <h2 class="section-label">서비스가 태어난 이야기</h2>
    <p class="reco-note">모든 이야기는 <strong>${nSeries}개의 퍼즐</strong>로 나뉘어 있고, 글을 하나 읽을 때마다
    조각이 하나 맞춰집니다. 자신과 가장 가까운 모습을 골라주세요.</p>
    <div class="audience-grid">
      ${DB.audiences.filter(a => isAllowed(a.key)).map(a => {
        const ss = DB.series.filter(s => s.audience === a.key);
        const total = ss.reduce((n, s) => n + s.articles.length, 0);
        const done = ss.reduce((n, s) => n + seriesProgress(s).size, 0);
        return `
        <button class="audience-card" data-key="${a.key}">
          <span class="emoji">${a.emoji}</span>
          <h2>${esc(a.name)}</h2>
          <p>${esc(a.tagline)}</p>
          <span class="audience-progress">🧩 퍼즐 ${ss.length}판 · ${done}/${total} 조각</span>
        </button>`;
      }).join('')}
    </div>`;
  app.querySelectorAll('.audience-card').forEach(btn =>
    btn.addEventListener('click', () => { location.hash = `#/t/${btn.dataset.key}`; }));
}

/* ---------- 제품(브랜드) 페이지 ----------
 * 하나의 앱을 '기원 스토리 → 누가 쓰면 좋은가 → 기능(각 기능이 태어난 이야기 링크) →
 * 뉴스레터' 순서로 소개한다. 팬이 이야기를 따라 기능의 이유를 이해하게 하는 구조. */
function renderProduct(key) {
  const p = productOf(key);
  if (!p) { location.hash = '#/'; return; }
  const st = PRODUCT_STATUS[p.status] || PRODUCT_STATUS.building;
  const storyItem = (cid) => {
    const c = contentOf(cid);
    if (!c) return '';
    const planned = isPlanned(c);
    return planned
      ? `<span class="feature-story planned" title="게시 예정">🔒 ${esc(c.title)} <em>(${esc(publishLabel(c))})</em></span>`
      : `<a class="feature-story" href="#/c/${cid}">📖 ${esc(c.title)}</a>`;
  };
  const relSeries = (p.series || []).map(seriesOf).filter(Boolean).filter(s => isAllowed(s.audience));
  const nls = newslettersOfProduct(key);
  app.innerHTML = `
    <div class="track-head">
      <div class="crumb"><a href="#/">← 처음으로</a></div>
      <h1>${p.emoji} ${esc(p.name)} <span class="product-status ${st.cls}">${st.label}</span></h1>
      <p>${esc(p.tagline)}</p>
    </div>
    <div class="product-hero">
      <h2 class="product-section">이 앱이 풀려는 문제</h2>
      <p>${esc(p.problem)}</p>
      <h2 class="product-section">누가, 왜 만들었나</h2>
      <p>${esc(p.origin)}</p>
      <h2 class="product-section">이런 분들이 쓰면 좋습니다</h2>
      <ul>${(p.forWho || []).map(w => `<li>${esc(w)}</li>`).join('')}</ul>
      <div class="product-links">
        <a class="product-link" href="${esc(p.repo)}" target="_blank" rel="noopener">🐙 GitHub에서 함께 만들기</a>
        ${p.site ? `<a class="product-link primary" href="${esc(p.site)}" target="_blank" rel="noopener">🚀 서비스 사용하기</a>` : `<span class="product-link soon">🛠 출시 준비 중 — 뉴스레터로 소식을 받아보세요</span>`}
        ${(p.links || []).map(l => `<a class="product-link" href="${esc(l.url)}" target="_blank" rel="noopener">🔗 ${esc(l.label)}</a>`).join('')}
      </div>
    </div>
    <h2 class="section-label">기능과, 기능이 태어난 이야기</h2>
    <p class="reco-note">기능은 그냥 만들지 않습니다 — 질문과 문제(이야기)가 먼저고, 기능은 그 답입니다.</p>
    <div class="feature-list">
      ${(p.features || []).map((f, i) => `
        <div class="feature-card">
          <h3><span class="feature-num">${i + 1}</span> ${esc(f.name)}</h3>
          <p>${esc(f.desc)}</p>
          ${(f.stories || []).length ? `<div class="feature-stories">${f.stories.map(storyItem).join('')}</div>` : ''}
        </div>`).join('')}
    </div>
    ${relSeries.length ? `
      <h2 class="section-label">이 앱의 뿌리가 된 퍼즐</h2>
      <div class="series-grid">${relSeries.map((s, i) => seriesCardHTML(s, getProfile(), { uid: '-p' + i })).join('')}</div>` : ''}
    ${nls.length ? `
      <h2 class="section-label">📮 이 앱의 뉴스레터</h2>
      <div class="content-list">${nls.map(n => `
        <a class="content-item" href="#/n/${n.id}">
          <div class="meta"><span class="tag">${esc(n.version || '')}</span><span class="pieces">${esc(fmtDate(n.date))}</span></div>
          <h3>${esc(n.title)}</h3>
        </a>`).join('')}</div>` : ''}
    <div class="back-row"><button class="ghost" onclick="location.hash='#/'">← 처음으로</button></div>
  `;
  window.scrollTo(0, 0);
}

/* ---------- 뉴스레터 목록 · 상세 ----------
 * newsletters/*.md 중 status: published만 contents.json에 실린다(선택적 발행).
 * 각 호는 퍼즐 스토리 요약 + 링크로 구성 — 앱 출시/버전 업에 맞춰 발행. */
function renderNewsletterList() {
  const nls = DB.newsletters || [];
  app.innerHTML = `
    <div class="track-head">
      <div class="crumb"><a href="#/">← 처음으로</a></div>
      <h1>📮 뉴스레터</h1>
      <p>앱 출시와 버전 업그레이드에 맞춰, 그 기능이 태어난 퍼즐 스토리를 요약해 전합니다.</p>
    </div>
    <div class="content-list" style="margin-top:20px">
      ${nls.length ? nls.map(n => {
        const p = productOf(n.product);
        return `
        <a class="content-item" href="#/n/${n.id}">
          <div class="meta">
            ${p ? `<span class="tag">${p.emoji} ${esc(p.name)}</span>` : ''}
            <span class="tag">${esc(n.version || '')}</span>
            <span class="pieces">${esc(fmtDate(n.date))}</span>
          </div>
          <h3>${esc(n.title)}</h3>
        </a>`;
      }).join('') : '<p class="reco-note">아직 발행된 뉴스레터가 없습니다.</p>'}
    </div>`;
}

async function renderNewsletter(id) {
  const n = (DB.newsletters || []).find(x => x.id === id);
  if (!n) { location.hash = '#/n'; return; }
  const p = productOf(n.product);
  app.innerHTML = `
    <div class="track-head">
      <div class="crumb"><a href="#/">처음</a> · <a href="#/n">📮 뉴스레터</a>${p ? ` · <a href="#/p/${p.key}">${p.emoji} ${esc(p.name)}</a>` : ''}</div>
    </div>
    <article class="article"><p class="loading">불러오는 중…</p></article>
    <div class="back-row"><button class="ghost" onclick="location.hash='#/n'">← 뉴스레터 목록으로</button></div>
  `;
  const articleEl = app.querySelector('.article');
  try {
    const md = await fetch(withVer(n.file)).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
    const body = md.replace(/^\s*---\s*\n[\s\S]*?\n---\s*\n?/, '');
    articleEl.innerHTML = marked.parse(body);
    // 뉴스레터 속 상대 md 링크도 글 라우트로 변환 (글 페이지와 동일한 슬러그 매칭)
    const slugKey = (path) => path.split('/').pop().replace(/\.md$/, '').replace(/^\d+-/, '');
    articleEl.querySelectorAll('a[href$=".md"]').forEach(a => {
      const target = DB.contents.find(x => slugKey(x.file) === slugKey(a.getAttribute('href')));
      if (target && isAllowed(target.audience) && !isPlanned(target)) a.setAttribute('href', `#/c/${target.id}`);
    });
  } catch (e) {
    articleEl.innerHTML = `<p>이 뉴스레터를 불러오지 못했습니다.</p>`;
  }
  window.scrollTo(0, 0);
}

/* ---------- 온보딩 위젯 (USA Swimming 등급 판정 등) ---------- */
function ageGroupOf(age) {
  const g = LEVELS.ageGroups.find(a => age >= a.min && age <= a.max);
  return g ? g.key : '17-18';
}

function parseTime(str) {
  const s = String(str).trim();
  if (!s) return null;
  const m = s.match(/^(?:(\d+):)?(\d{1,2}(?:\.\d{1,2})?)$/);
  if (!m) return null;
  return (m[1] ? parseInt(m[1], 10) * 60 : 0) + parseFloat(m[2]);
}

function levelFromRecord(ageGroup, course, event, sex, sec) {
  const std = LEVELS.standards[ageGroup]?.[course]?.[event]?.[sex];
  if (!std || !(sec > 0)) return null;
  let achieved = 'PRE_B';
  for (const lvl of LEVELS.levelOrder) {
    if (std[lvl] != null && sec <= std[lvl]) achieved = lvl;
  }
  if (achieved === 'AAAA' && sec <= std['AAAA'] * 0.98) achieved = 'AAAA_PLUS';
  return { level: achieved, standards: std };
}

function eventsFor(ageGroup, course) {
  const evs = Object.keys(LEVELS.standards[ageGroup]?.[course] || {});
  return evs.sort((a, b) => {
    const [da, sa] = a.split(' '); const [db, sb] = b.split(' ');
    const order = ['FR', 'BK', 'BR', 'FL', 'IM'];
    return order.indexOf(sa) - order.indexOf(sb) || (+da) - (+db);
  });
}

function eventLabel(ev) {
  const [dist, stroke] = ev.split(' ');
  return `${LEVELS.strokeLabels[stroke] || stroke} ${dist}`;
}

function onboardingHTML(aud, profile, expanded) {
  if (aud.onboarding === 'level') {
    const p = profile.swimmer || {};
    // 레벨이 판정되어 있으면 요약 바로 최소화 — 퍼즐 보드가 주인공이 되도록
    if (p.level && !expanded) {
      const info = LEVELS.levelLabels[p.level] || {};
      const next = (p.nextLevel && p.nextGap != null)
        ? ` · 다음 ${esc((LEVELS.levelLabels[p.nextLevel] || {}).name || p.nextLevel)}까지 ${p.nextGap.toFixed(2)}초`
        : '';
      return `
      <div class="onboarding-mini" id="onboarding">
        <span class="level-chip">${esc(info.name || p.level)}</span>
        <span class="mini-desc">${esc(info.ko || '')} · ${esc(eventLabel(p.event))} ${esc(p.course)} ${esc(p.time)}${next}</span>
        <button class="ghost mini-edit" id="ob-edit">수정</button>
      </div>`;
    }
    const ageGroup = p.age ? ageGroupOf(p.age) : '11-12';
    const course = p.course || 'SCY';
    return `
      <div class="onboarding" id="onboarding">
        <h3>🏊 내 레벨로 퍼즐 열기 <small style="font-weight:400;color:var(--text-dim)">USA Swimming 공식 기준</small></h3>
        <p class="sub">나이·성별·종목·베스트 기록을 입력하면 등급(B → AAAA)을 판정하고, <strong>내 등급에 맞는 퍼즐이 활성화</strong>됩니다.</p>
        <label>나이</label>
        <input id="ob-age" type="number" min="5" max="25" placeholder="12" value="${p.age || ''}" />
        <label>성별</label>
        <select id="ob-sex">
          <option value="F" ${p.sex === 'F' ? 'selected' : ''}>여자 (Girls)</option>
          <option value="M" ${p.sex === 'M' ? 'selected' : ''}>남자 (Boys)</option>
        </select>
        <label>코스</label>
        <select id="ob-course">
          ${Object.entries(LEVELS.courses).map(([k, v]) => `<option value="${k}" ${course === k ? 'selected' : ''}>${k} — ${esc(v)}</option>`).join('')}
        </select>
        <label>종목</label>
        <select id="ob-event">
          ${eventsFor(ageGroup, course).map(ev => `<option value="${ev}" ${p.event === ev ? 'selected' : ''}>${esc(eventLabel(ev))}</option>`).join('')}
        </select>
        <label>베스트 기록 — 예: 31.50 또는 1:08.29</label>
        <input id="ob-time" type="text" inputmode="decimal" placeholder="31.50" value="${p.time || ''}" />
        <div class="actions">
          <button class="primary" id="ob-run">레벨 확인</button>
          ${p.level ? `<button class="ghost" id="ob-reset">초기화</button>` : ''}
        </div>
        <div id="ob-result">${p.level ? levelResultHTML(p) : ''}</div>
        <p class="sub" style="margin-top:14px">기준 출처: <a href="${LEVELS.source.url}" target="_blank" rel="noopener" style="color:var(--accent)">USA Swimming Time Standards</a> (${esc(LEVELS.source.name)})</p>
      </div>`;
  }
  if (aud.onboarding === 'stage') {
    return `
      <div class="onboarding" id="onboarding">
        <h3>👨‍👩‍👧‍👦 우리 아이는 지금 어느 단계인가요?</h3>
        <p class="sub">단계를 고르면 그 시기의 퍼즐이 활성화됩니다.</p>
        <div class="chip-row">
          ${aud.stages.map(s => `
            <button class="chip ${profile.parentStage === s.key ? 'active' : ''}" data-stage="${s.key}">
              ${esc(s.name)}<small>${esc(s.hint)}</small>
            </button>`).join('')}
        </div>
      </div>`;
  }
  if (aud.onboarding === 'interest') {
    return `
      <div class="onboarding" id="onboarding">
        <h3>💻 어떤 이야기가 궁금하세요?</h3>
        <p class="sub">관심사를 고르면 그 주제의 퍼즐이 활성화됩니다.</p>
        <div class="chip-row">
          ${aud.interests.map(i => `
            <button class="chip ${profile.builderInterest === i.key ? 'active' : ''}" data-interest="${i.key}">${esc(i.name)}</button>`).join('')}
        </div>
      </div>`;
  }
  return '';
}

function levelResultHTML(p) {
  const info = LEVELS.levelLabels[p.level];
  if (!info) return '';
  let next = '';
  if (p.nextLevel && p.nextGap != null) {
    next = ` 다음 등급 <strong>${esc(LEVELS.levelLabels[p.nextLevel].name)}</strong>까지 <strong>${p.nextGap.toFixed(2)}초</strong>.`;
  } else if (p.level === 'AAAA' || p.level === 'AAAA_PLUS') {
    next = ` 다음 무대는 ${LEVELS.championshipLadder.steps.join(' → ')}.`;
  }
  return `<div class="level-result">판정: <strong>${esc(info.name)} · ${esc(info.ko)}</strong> (${esc(p.ageGroup)} ${p.sex === 'F' ? 'Girls' : 'Boys'}, ${esc(eventLabel(p.event))} ${esc(p.course)}) — ${esc(info.hint)}.${next} 이 등급의 퍼즐이 아래에서 활성화되었습니다.</div>`;
}

/* ---------- 시리즈(퍼즐) 카드 ---------- */
function seriesCardHTML(s, profile, opts = {}) {
  const state = seriesState(s, profile);
  const revealed = seriesProgress(s);
  const total = s.articles.length;
  const sex = (profile.swimmer && profile.swimmer.sex) || 'M';
  const svg = window.PUZZLE.render(s, revealed, { sex, locked: state !== 'active', uid: opts.uid || '' });
  const stateBadge = state === 'active'
    ? `<span class="series-state on">지금 나의 퍼즐</span>`
    : state === 'unknown'
    ? `<span class="series-state">${esc(s.unlockLabel)}</span>`
    : `<span class="series-state">${esc(s.unlockLabel)}</span>`;
  const done = revealed.size === total;
  return `
    <a class="series-card ${state !== 'active' ? 'dimmed' : ''} ${done ? 'complete' : ''}" href="#/s/${s.id}">
      <div class="series-art">${svg}${done ? '<span class="series-done">🏆 완성!</span>' : ''}</div>
      <div class="series-body">
        <div class="series-meta">${stateBadge}<span class="pieces">🧩 ${revealed.size}/${total}</span></div>
        <h3>${s.emoji} ${esc(s.title)}</h3>
        <p>${esc(s.question)}</p>
      </div>
    </a>`;
}

/* ---------- 트랙 페이지: 온보딩 + 퍼즐 시리즈 + 교차 추천 ---------- */
function renderTrack(key, opts = {}) {
  const aud = audienceOf(key);
  if (!aud || !isAllowed(key)) { location.hash = '#/'; return; }
  const profile = getProfile();

  const mySeries = DB.series.filter(s => s.audience === key);
  const stateRank = { active: 0, unknown: 1, dim: 2 };
  const sorted = [...mySeries].sort((a, b) => stateRank[seriesState(a, profile)] - stateRank[seriesState(b, profile)]);
  const anyProfileNeeded = aud.onboarding !== 'none' && sorted.some(s => seriesState(s, profile) === 'unknown');

  // 교차 추천: 이 트랙 글들의 related 중 다른 트랙 글 (아마존식)
  const mine = DB.contents.filter(c => c.audience === key);
  const recoIds = [...new Set(mine.flatMap(c => c.related || []))]
    .filter(id => { const c = contentOf(id); return c && c.audience !== key && isAllowed(c.audience); })
    .slice(0, 4);

  app.innerHTML = `
    <div class="track-head">
      <div class="crumb"><a href="#/">← 처음으로</a></div>
      <h1>${aud.emoji} ${esc(aud.name)}</h1>
      <p>${esc(aud.tagline)}</p>
    </div>
    ${onboardingHTML(aud, profile, opts.editProfile)}
    <h2 class="section-label">나의 퍼즐 보드</h2>
    ${anyProfileNeeded ? `<p class="reco-note">🔍 위에서 ${aud.onboarding === 'level' ? '기록을 입력' : '선택'}하면 흐린 퍼즐 중 나에게 맞는 것이 켜집니다.</p>` : ''}
    <div class="series-grid">
      ${sorted.map((s, i) => seriesCardHTML(s, profile, { uid: '-t' + i })).join('')}
    </div>
    ${recoIds.length ? `
      <h2 class="section-label">함께 보면 좋은 콘텐츠</h2>
      <p class="reco-note">이 트랙의 독자들이 함께 읽는 다른 트랙의 글입니다.</p>
      <div class="content-list">
        ${recoIds.map(id => contentItemHTML(contentOf(id), { isReco: true })).join('')}
      </div>` : ''}
  `;

  // 온보딩 이벤트
  const editBtn = document.getElementById('ob-edit');
  if (editBtn) editBtn.addEventListener('click', () => renderTrack(key, { editProfile: true }));
  const ageEl = document.getElementById('ob-age');
  const courseEl = document.getElementById('ob-course');
  const eventEl = document.getElementById('ob-event');
  const refreshEvents = () => {
    const age = parseInt(ageEl.value, 10);
    const ag = ageGroupOf(isNaN(age) ? 12 : age);
    const prev = eventEl.value;
    eventEl.innerHTML = eventsFor(ag, courseEl.value)
      .map(ev => `<option value="${ev}" ${ev === prev ? 'selected' : ''}>${esc(eventLabel(ev))}</option>`).join('');
  };
  if (ageEl) ageEl.addEventListener('change', refreshEvents);
  if (courseEl) courseEl.addEventListener('change', refreshEvents);

  const runBtn = document.getElementById('ob-run');
  if (runBtn) runBtn.addEventListener('click', () => {
    const age = parseInt(ageEl.value, 10);
    const sex = document.getElementById('ob-sex').value;
    const course = courseEl.value;
    const event = eventEl.value;
    const timeStr = document.getElementById('ob-time').value;
    const sec = parseTime(timeStr);
    if (isNaN(age) || age < 5) { document.getElementById('ob-result').innerHTML = `<div class="level-result">나이를 입력해주세요.</div>`; return; }
    if (sec == null) { document.getElementById('ob-result').innerHTML = `<div class="level-result">기록을 31.50 또는 1:08.29 형식으로 입력해주세요.</div>`; return; }
    const ageGroup = ageGroupOf(age);
    const res = levelFromRecord(ageGroup, course, event, sex, sec);
    if (!res) { document.getElementById('ob-result').innerHTML = `<div class="level-result">이 연령대·코스에는 해당 종목 기준이 없습니다. 다른 종목을 선택해주세요.</div>`; return; }
    const order = LEVELS.levelOrder;
    const idx = order.indexOf(res.level);
    let nextLevel = null, nextGap = null;
    if (res.level === 'PRE_B') { nextLevel = 'B'; nextGap = sec - res.standards['B']; }
    else if (idx >= 0 && idx < order.length - 1) { nextLevel = order[idx + 1]; nextGap = sec - res.standards[nextLevel]; }
    setProfile({ swimmer: { age, ageGroup, sex, course, event, time: timeStr, sec, level: res.level, nextLevel, nextGap } });
    renderTrack(key);
  });
  const resetBtn = document.getElementById('ob-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => { setProfile({ swimmer: null }); renderTrack(key); });

  app.querySelectorAll('[data-stage]').forEach(b =>
    b.addEventListener('click', () => { setProfile({ parentStage: b.dataset.stage }); renderTrack(key); }));
  app.querySelectorAll('[data-interest]').forEach(b =>
    b.addEventListener('click', () => { setProfile({ builderInterest: b.dataset.interest }); renderTrack(key); }));
}

/* ---------- 시리즈 페이지: 퍼즐 + 조각(글) 목록 ---------- */
function renderSeries(id) {
  const s = seriesOf(id);
  if (!s || !isAllowed(s.audience)) { location.hash = '#/'; return; }
  const aud = audienceOf(s.audience);
  const profile = getProfile();
  const revealed = seriesProgress(s);
  const total = s.articles.length;
  const sex = (profile.swimmer && profile.swimmer.sex) || 'M';
  const state = seriesState(s, profile);

  // 방금 읽은 글의 조각이 있으면 반짝임 효과
  let flash = null;
  const flashId = sessionStorage.getItem('pz-flash');
  if (flashId) {
    const idx = s.articles.indexOf(flashId);
    if (idx >= 0 && revealed.has(idx)) flash = idx;
    sessionStorage.removeItem('pz-flash');
  }

  const svg = window.PUZZLE.render(s, revealed, { sex, flash, uid: '-d' });
  const done = revealed.size === total;
  const read = getRead();
  // '다음 조각'은 아직 안 읽었으면서 실제로 읽을 수 있는(게시된) 글이어야 한다.
  // planned(미작성) 글은 건너뛴다 — 없는 본문으로 안내하지 않도록.
  const nextIdx = s.articles.findIndex(a => !read[a] && !isPlanned(contentOf(a)));
  // 읽을 수 있는 다음 조각이 없을 때(모두 게시 예정) 안내할 가장 이른 planned 글
  const upcoming = contentOf(s.articles.find(a => isPlanned(contentOf(a))));
  const credit = window.PUZZLE.creditFor(s, sex);

  app.innerHTML = `
    <div class="track-head">
      <div class="crumb"><a href="#/">처음</a> · <a href="#/t/${s.audience}">${aud.emoji} ${esc(aud.name)}</a></div>
      <h1>${s.emoji} ${esc(s.title)}</h1>
      <p>${esc(s.question)}</p>
    </div>
    <div class="series-hero ${done ? 'complete' : ''}">
      ${svg}
      <div class="series-hero-info">
        <div class="series-progressbar"><span style="width:${(revealed.size / total) * 100}%"></span></div>
        <p class="series-count">${done
          ? '🏆 <strong>퍼즐 완성!</strong> 사진이 모두 열렸습니다.'
          : `🧩 <strong>${revealed.size}/${total} 조각</strong> — 글을 하나 읽을 때마다 사진이 한 조각씩 열립니다.`}</p>
        ${!done && nextIdx >= 0 ? `<a class="piece-next" href="#/c/${s.articles[nextIdx]}">다음 조각 읽기 → ${esc(contentOf(s.articles[nextIdx]).title)}</a>` : ''}
        ${!done && nextIdx < 0 && upcoming ? `<p class="series-upcoming">🔒 다음 조각 <strong>${esc(upcoming.title)}</strong> — ${esc(publishLabel(upcoming))}</p>` : ''}
        ${state !== 'active' && !done ? `<p class="series-lockhint">${esc(s.unlockLabel)} — 지금도 읽을 수 있지만, <a href="#/t/${s.audience}">프로필을 맞추면</a> 나의 퍼즐로 표시됩니다.</p>` : ''}
      </div>
    </div>
    <h2 class="section-label">퍼즐 조각 ${revealed.size}/${total}</h2>
    <div class="piece-grid">
      ${s.articles.map((cid, i) => {
        const c = contentOf(cid);
        const isRead = !!read[cid];
        const planned = isPlanned(c);
        const isNext = i === nextIdx;
        const thumb = window.PUZZLE.renderPiece(s, i, isRead, { sex, uid: '-g' });
        const inner = `
          <div class="piece-thumb">${thumb}${isRead ? '' : `<span class="piece-num">${i + 1}</span>`}</div>
          <div class="piece-info">
            <span class="piece-status">${planned ? '🔒 게시 예정' : isRead ? '🧩 조각 완성' : isNext ? '▶ 다음 조각' : `조각 ${i + 1}`}</span>
            <h3>${esc(c.title)}</h3>
            ${planned ? `<span class="piece-publish">🗓 ${esc(publishLabel(c))}</span>` : ''}
          </div>`;
        // planned은 클릭 불가(a 대신 div). 나머지는 글로 이동.
        return planned
          ? `<div class="piece-card planned" aria-disabled="true" title="아직 작성 중인 글입니다">${inner}</div>`
          : `<a class="piece-card ${isRead ? 'read' : ''} ${isNext ? 'next' : ''}" href="#/c/${cid}">${inner}</a>`;
      }).join('')}
    </div>
    ${credit && (credit.artist || credit.source) ? `<p class="photo-credit">사진: ${esc(credit.artist || 'Unknown')}${credit.source ? ` · <a href="${esc(credit.source)}" target="_blank" rel="noopener">Wikimedia Commons</a>` : ''}${credit.license ? ` · ${esc(credit.license)}` : ''}</p>` : ''}
    <div class="back-row"><button class="ghost" onclick="location.hash='#/t/${s.audience}'">← 퍼즐 보드로</button></div>
  `;
  window.scrollTo(0, 0);
}

function tagLabel(c) {
  const aud = audienceOf(c.audience);
  if (c.audience === 'swimmer') {
    const ages = (c.ages || []).map(k => {
      const g = LEVELS.ageGroups.find(a => a.key === k);
      return g ? g.label : k;
    });
    const ageStr = ages.length ? ` · ${ages[0]}${ages.length > 1 ? `~${ages[ages.length - 1]}` : ''}` : '';
    return `${c.tag}${ageStr}`;
  }
  if (c.audience === 'parent') {
    const s = (aud.stages || []).find(s => s.key === c.tag);
    return s ? `${c.tag} ${s.name}` : c.tag;
  }
  if (c.audience === 'builder') {
    const i = (aud.interests || []).find(i => i.key === c.tag);
    return i ? i.name : c.tag;
  }
  return c.tag;
}

function contentItemHTML(c, opts = {}) {
  const { matched = false, isReco = false } = opts;
  const aud = audienceOf(c.audience);
  const planned = isPlanned(c);
  const inner = `
      <div class="meta">
        <span class="tag ${matched ? 'match' : ''}">${isReco ? `${aud.emoji} ${esc(aud.name)}` : esc(tagLabel(c))}</span>
        <span class="pieces">${planned ? `🗓 ${esc(publishLabel(c))}` : `🧩 ${c.pieces}조각`}</span>
      </div>
      <h3>${esc(c.title)}</h3>`;
  return planned
    ? `<div class="content-item planned" aria-disabled="true" title="아직 작성 중인 글입니다">${inner}</div>`
    : `<a class="content-item" href="#/c/${c.id}">${inner}</a>`;
}

/* ---------- 글 페이지: md 로드 + 조각 획득 ---------- */
async function renderArticle(id) {
  const c = contentOf(id);
  if (!c || !isAllowed(c.audience)) { location.hash = '#/'; return; }
  const aud = audienceOf(c.audience);
  const series = seriesOfContent(id);
  const pieceIdx = series ? series.articles.indexOf(id) : -1;

  // 게시 예정(planned) 글은 본문이 없다. 직접 진입(해시 등)해도 시리즈로 돌려보낸다.
  if (isPlanned(c)) { location.hash = series ? `#/s/${series.id}` : `#/t/${c.audience}`; return; }

  const crumbSeries = series ? ` · <a href="#/s/${series.id}">${series.emoji} ${esc(series.title)}</a>` : '';
  app.innerHTML = `
    <div class="track-head">
      <div class="crumb"><a href="#/">처음</a> · <a href="#/t/${c.audience}">${aud.emoji} ${esc(aud.name)}</a>${crumbSeries}</div>
    </div>
    <article class="article"><p class="loading">퍼즐을 펼치는 중…</p></article>
    <div class="back-row"><button class="ghost" onclick="location.hash='${series ? `#/s/${series.id}` : `#/t/${c.audience}`}'">← ${series ? '퍼즐로' : '목록으로'}</button></div>
  `;

  const articleEl = app.querySelector('.article');
  try {
    const md = await fetch(withVer(c.file)).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
    // 상단 YAML frontmatter(--- ... ---)는 빌드용 메타데이터이므로 렌더 전에 제거한다.
    const body = md.replace(/^\s*---\s*\n[\s\S]*?\n---\s*\n?/, '');
    articleEl.innerHTML = marked.parse(body);
    // 글 안의 상대 md 링크를 SPA 라우트로 변환.
    // 파일명 앞의 조각 번호(NN-)는 무시하고 슬러그로 매칭한다 (폴더/번호가 바뀌어도 안 깨지게).
    const slugKey = (path) => path.split('/').pop().replace(/\.md$/, '').replace(/^\d+-/, '');
    articleEl.querySelectorAll('a[href$=".md"]').forEach(a => {
      const wantSlug = slugKey(a.getAttribute('href'));
      const target = DB.contents.find(x => slugKey(x.file) === wantSlug);
      if (target && isAllowed(target.audience)) {
        a.setAttribute('href', `#/c/${target.id}`);
      } else if (target) {
        const span = document.createElement('span');
        span.textContent = a.textContent;
        a.replaceWith(span);
      }
    });

    // 읽음 처리 → 조각 획득. 시리즈가 있으면 획득 배너 + 다음 조각 안내를 글 끝에 붙인다.
    const isNew = markRead(id);
    if (series) {
      sessionStorage.setItem('pz-flash', id);
      const read = getRead();
      const doneCount = series.articles.filter(a => read[a]).length;
      // 다음 조각: 안 읽은 '게시된' 글 우선. 없으면 게시 예정(planned) 글을 안내.
      const nextId = series.articles.find(a => !read[a] && !isPlanned(contentOf(a)));
      const next = nextId ? contentOf(nextId) : null;
      const upcoming = next ? null : contentOf(series.articles.find(a => !read[a] && isPlanned(contentOf(a))));
      const banner = document.createElement('div');
      banner.className = 'piece-earned' + (isNew ? ' new' : '');
      banner.innerHTML = `
        <div class="piece-earned-head">🧩 조각 ${pieceIdx + 1} ${isNew ? '획득!' : '(이미 맞춘 조각)'} — <strong>${doneCount}/${series.articles.length}</strong></div>
        ${next
          ? `<a class="piece-next" href="#/c/${next.id}">다음 조각 → ${esc(next.title)}</a>`
          : upcoming
          ? `<div class="piece-next-done">🔒 다음 조각 <strong>${esc(upcoming.title)}</strong> — ${esc(publishLabel(upcoming))}</div>`
          : `<div class="piece-next-done">🏆 퍼즐의 마지막 조각까지 완성! <a href="#/s/${series.id}">완성된 그림 보러 가기</a></div>`}
        <a class="piece-board" href="#/s/${series.id}">퍼즐 진행도 보기</a>`;
      articleEl.after(banner);
    }
  } catch (e) {
    articleEl.innerHTML = `<p>이 글은 아직 준비 중입니다. (${esc(c.title)})</p>`;
  }

  // 이 이야기에서 태어난 기능: 스토리 → 제품 Feature 역링크.
  // 글을 읽은 독자가 '이 문제의 답이 앱의 이 기능'임을 바로 확인하고 제품으로 넘어간다.
  const born = productsOfStory(id);
  if (born.length) {
    const div = document.createElement('div');
    div.innerHTML = `
      <h2 class="section-label">이 이야기에서 태어난 기능</h2>
      <div class="content-list">${born.map(({ p, feats }) => `
        <a class="content-item story-feature" href="#/p/${p.key}">
          <div class="meta"><span class="tag">${p.emoji} ${esc(p.name)}</span></div>
          <h3>${feats.map(f => esc(f.name)).join(' · ')}</h3>
          <p class="feature-hint">${esc(feats[0].desc)}</p>
        </a>`).join('')}</div>`;
    app.querySelector('.back-row').before(div);
  }

  // 하단 교차 추천
  const related = (c.related || []).map(contentOf).filter(Boolean)
    .filter(r => isAllowed(r.audience));
  if (related.length) {
    const div = document.createElement('div');
    div.innerHTML = `
      <h2 class="section-label">함께 보면 좋은 콘텐츠</h2>
      <div class="content-list">${related.map(r => contentItemHTML(r, { isReco: r.audience !== c.audience })).join('')}</div>`;
    app.querySelector('.back-row').before(div);
  }
  window.scrollTo(0, 0);
}

/* ---------- 라우터 ---------- */
async function route() {
  await loadData();
  const hash = location.hash || '#/';
  const [, kind, param] = hash.split('/');
  if (kind === 't' && param) return renderTrack(param);
  if (kind === 's' && param) return renderSeries(decodeURIComponent(param));
  if (kind === 'c' && param) return renderArticle(decodeURIComponent(param));
  if (kind === 'p' && param) return renderProduct(decodeURIComponent(param));
  if (kind === 'n') return param ? renderNewsletter(decodeURIComponent(param)) : renderNewsletterList();
  return renderHome();
}

window.addEventListener('hashchange', route);
route();
