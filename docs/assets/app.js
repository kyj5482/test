/* SPA for GitHub Pages personal branding site.
 * Routes: #/ (독자 선택) · #/t/<audience> (트랙) · #/s/<seriesId> (퍼즐 시리즈) · #/c/<contentId> (글)
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
const audienceOf = (key) => DB.audiences.find(a => a.key === key);
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

/* ---------- 홈: 1단계 독자 선택 ---------- */
function renderHome() {
  const t = themeKey();
  const heroTitle = t === 'swim'
    ? '두 수영 선수를 키우는 아빠의<br/>물살 위 성장 기록.'
    : t === 'dev'
    ? '차량 데이터 플랫폼을 만들어온<br/>20년차 엔지니어의 기록.'
    : '차량 데이터 플랫폼을 만드는 엔지니어,<br/>두 수영 선수를 키우는 아빠.';
  const nSeries = DB.series.filter(s => isAllowed(s.audience)).length;
  app.innerHTML = `
    <section class="hero">
      <h1>${heroTitle}</h1>
      <p>모든 이야기는 <strong>${nSeries}개의 퍼즐</strong>로 나뉘어 있습니다.
      글을 하나 읽을 때마다 조각이 하나 맞춰집니다.<br/>먼저, 자신과 가장 가까운 모습을 골라주세요.</p>
    </section>
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
  const nextIdx = s.articles.findIndex(a => !read[a]);
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
        ${state !== 'active' && !done ? `<p class="series-lockhint">${esc(s.unlockLabel)} — 지금도 읽을 수 있지만, <a href="#/t/${s.audience}">프로필을 맞추면</a> 나의 퍼즐로 표시됩니다.</p>` : ''}
      </div>
    </div>
    <h2 class="section-label">퍼즐 조각 ${revealed.size}/${total}</h2>
    <div class="piece-grid">
      ${s.articles.map((cid, i) => {
        const c = contentOf(cid);
        const isRead = !!read[cid];
        const isNext = i === nextIdx;
        const thumb = window.PUZZLE.renderPiece(s, i, isRead, { sex, uid: '-g' });
        return `
        <a class="piece-card ${isRead ? 'read' : ''} ${isNext ? 'next' : ''}" href="#/c/${cid}">
          <div class="piece-thumb">${thumb}${isRead ? '' : `<span class="piece-num">${i + 1}</span>`}</div>
          <div class="piece-info">
            <span class="piece-status">${isRead ? '🧩 조각 완성' : isNext ? '▶ 다음 조각' : `조각 ${i + 1}`}</span>
            <h3>${esc(c.title)}</h3>
          </div>
        </a>`;
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
  return `
    <a class="content-item" href="#/c/${c.id}">
      <div class="meta">
        <span class="tag ${matched ? 'match' : ''}">${isReco ? `${aud.emoji} ${esc(aud.name)}` : esc(tagLabel(c))}</span>
        <span class="pieces">🧩 ${c.pieces}조각</span>
      </div>
      <h3>${esc(c.title)}</h3>
    </a>`;
}

/* ---------- 글 페이지: md 로드 + 조각 획득 ---------- */
async function renderArticle(id) {
  const c = contentOf(id);
  if (!c || !isAllowed(c.audience)) { location.hash = '#/'; return; }
  const aud = audienceOf(c.audience);
  const series = seriesOfContent(id);
  const pieceIdx = series ? series.articles.indexOf(id) : -1;

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
    articleEl.innerHTML = marked.parse(md);
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
      const nextId = series.articles.find(a => !read[a]);
      const next = nextId ? contentOf(nextId) : null;
      const banner = document.createElement('div');
      banner.className = 'piece-earned' + (isNew ? ' new' : '');
      banner.innerHTML = `
        <div class="piece-earned-head">🧩 조각 ${pieceIdx + 1} ${isNew ? '획득!' : '(이미 맞춘 조각)'} — <strong>${doneCount}/${series.articles.length}</strong></div>
        ${next
          ? `<a class="piece-next" href="#/c/${next.id}">다음 조각 → ${esc(next.title)}</a>`
          : `<div class="piece-next-done">🏆 퍼즐의 마지막 조각까지 완성! <a href="#/s/${series.id}">완성된 그림 보러 가기</a></div>`}
        <a class="piece-board" href="#/s/${series.id}">퍼즐 진행도 보기</a>`;
      articleEl.after(banner);
    }
  } catch (e) {
    articleEl.innerHTML = `<p>이 글은 아직 준비 중입니다. (${esc(c.title)})</p>`;
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
  return renderHome();
}

window.addEventListener('hashchange', route);
route();
