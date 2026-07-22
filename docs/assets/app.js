/* SPA for GitHub Pages personal branding site.
 * Routes: #/ (독자 선택) · #/t/<audience> (트랙) · #/c/<contentId> (글)
 * 독자 프로필(레벨/단계/관심사)은 localStorage에 저장되어 맞춤 정렬에 사용된다. */

const app = document.getElementById('app');
let DB = null;      // contents.json
let LEVELS = null;  // levels.json

const PROFILE_KEY = 'pb-profile';
const getProfile = () => JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
const setProfile = (patch) => {
  const p = { ...getProfile(), ...patch };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  return p;
};

async function loadData() {
  if (DB && LEVELS) return;
  const [c, l] = await Promise.all([
    fetch('data/contents.json').then(r => r.json()),
    fetch('data/levels.json').then(r => r.json()),
  ]);
  DB = c; LEVELS = l;
}

const esc = (s) => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const audienceOf = (key) => DB.audiences.find(a => a.key === key);
const contentOf = (id) => DB.contents.find(c => c.id === id);

/* ---------- 홈: 1단계 독자 선택 ---------- */
function renderHome() {
  app.innerHTML = `
    <section class="hero">
      <h1>차량 데이터 플랫폼을 만드는 엔지니어,<br/>두 수영 선수를 키우는 아빠.</h1>
      <p>모든 이야기는 질문에서 출발합니다. 당신은 어떤 질문을 갖고 오셨나요?<br/>아래에서 자신과 가장 가까운 모습을 골라주세요.</p>
    </section>
    <div class="audience-grid">
      ${DB.audiences.map(a => `
        <button class="audience-card" data-key="${a.key}">
          <span class="emoji">${a.emoji}</span>
          <h2>${esc(a.name)}</h2>
          <p>${esc(a.tagline)}</p>
        </button>`).join('')}
    </div>`;
  app.querySelectorAll('.audience-card').forEach(btn =>
    btn.addEventListener('click', () => { location.hash = `#/t/${btn.dataset.key}`; }));
}

/* ---------- 온보딩 위젯 ---------- */
/* USA Swimming 2024-2028 Motivational Standards 기반 레벨 판정.
 * 기준: standards[ageGroup][course][event][sex] = {B..AAAA: 초}.
 * 기록이 기준 이하(빠름)이면 해당 등급. B보다 느리면 PRE_B, AAAA보다 빠르면 AAAA_PLUS. */
function ageGroupOf(age) {
  const g = LEVELS.ageGroups.find(a => age >= a.min && age <= a.max);
  return g ? g.key : '17-18'; // 19세 이상은 최상위 연령대 기준으로 판정
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
  for (const lvl of LEVELS.levelOrder) {       // B → AAAA (빠른 순으로 갱신)
    if (std[lvl] != null && sec <= std[lvl]) achieved = lvl;
  }
  if (achieved === 'AAAA') {
    // AAAA 기준을 여유 있게(2% 이상) 통과하면 챔피언십 트랙 후보로 안내
    if (sec <= std['AAAA'] * 0.98) achieved = 'AAAA_PLUS';
  }
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

function fmtTime(sec) {
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    return `${m}:${(sec - m * 60).toFixed(2).padStart(5, '0')}`;
  }
  return sec.toFixed(2);
}

function onboardingHTML(aud, profile) {
  if (aud.onboarding === 'level') {
    const p = profile.swimmer || {};
    const ageGroup = p.age ? ageGroupOf(p.age) : '11-12';
    const course = p.course || 'SCY';
    return `
      <div class="onboarding">
        <h3>🏊 내 레벨 알아보기 <small style="font-weight:400;color:var(--text-dim)">USA Swimming 공식 기준</small></h3>
        <p class="sub">나이·성별·종목·베스트 기록을 입력하면 USA Swimming 2024–2028 Motivational Standards(B → AAAA)로 등급을 판정하고, 맞는 글부터 보여드립니다.</p>
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
      <div class="onboarding">
        <h3>👨‍👩‍👧‍👦 우리 아이는 지금 어느 단계인가요?</h3>
        <p class="sub">단계를 고르면 그 시기에 필요한 글부터 보여드립니다.</p>
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
      <div class="onboarding">
        <h3>💻 어떤 이야기가 궁금하세요?</h3>
        <p class="sub">관심사를 고르면 그 주제의 글부터 보여드립니다.</p>
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
  return `<div class="level-result">판정: <strong>${esc(info.name)} · ${esc(info.ko)}</strong> (${esc(p.ageGroup)} ${p.sex === 'F' ? 'Girls' : 'Boys'}, ${esc(eventLabel(p.event))} ${esc(p.course)}) — ${esc(info.hint)}.${next} 아래 목록이 이 등급에 맞게 정렬되었습니다.</div>`;
}

/* ---------- 트랙 페이지: 온보딩 + 맞춤 목록 + 교차 추천 ---------- */
function renderTrack(key) {
  const aud = audienceOf(key);
  if (!aud) { location.hash = '#/'; return; }
  const profile = getProfile();

  const mine = DB.contents.filter(c => c.audience === key);

  // 콘텐츠가 현재 프로필에 맞는지 판정
  const sw = profile.swimmer || {};
  const isMatch = (c) => {
    if (key === 'swimmer') {
      if (!sw.level) return false;
      const lvlOk = !c.levels || c.levels.includes(sw.level);
      const ageOk = !c.ages || !sw.ageGroup || c.ages.includes(sw.ageGroup);
      const sexOk = !c.sex || c.sex === 'all' || c.sex === sw.sex;
      return lvlOk && ageOk && sexOk;
    }
    if (key === 'parent') return profile.parentStage && c.tag === profile.parentStage;
    if (key === 'builder') return profile.builderInterest && c.tag === profile.builderInterest;
    return false;
  };
  const hasProfile = key === 'swimmer' ? !!sw.level
                   : key === 'parent' ? !!profile.parentStage
                   : key === 'builder' ? !!profile.builderInterest
                   : false;
  const matchTag = hasProfile;
  const sorted = [...mine].sort((a, b) => (isMatch(a) ? 0 : 1) - (isMatch(b) ? 0 : 1));

  // 교차 추천: 이 트랙 글들의 related 중 다른 트랙 글 (아마존식 "함께 본 콘텐츠")
  const recoIds = [...new Set(mine.flatMap(c => c.related || []))]
    .filter(id => { const c = contentOf(id); return c && c.audience !== key; });

  app.innerHTML = `
    <div class="track-head">
      <div class="crumb"><a href="#/">← 처음으로</a></div>
      <h1>${aud.emoji} ${esc(aud.name)}</h1>
      <p>${esc(aud.tagline)}</p>
    </div>
    ${onboardingHTML(aud, profile)}
    <h2 class="section-label">나를 위한 퍼즐</h2>
    <div class="content-list">
      ${sorted.map(c => contentItemHTML(c, { matched: isMatch(c), hasProfile })).join('')}
    </div>
    ${recoIds.length ? `
      <h2 class="section-label">함께 보면 좋은 콘텐츠</h2>
      <p class="reco-note">이 트랙의 독자들이 함께 읽는 다른 트랙의 글입니다.</p>
      <div class="content-list">
        ${recoIds.map(id => contentItemHTML(contentOf(id), { isReco: true })).join('')}
      </div>` : ''}
  `;

  // 온보딩 이벤트
  const ageEl = document.getElementById('ob-age');
  const courseEl = document.getElementById('ob-course');
  const eventEl = document.getElementById('ob-event');
  // 나이/코스가 바뀌면 해당 연령대·코스에 존재하는 종목으로 목록 갱신
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
    // 다음 등급까지 남은 시간 계산
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
  const { matched = false, hasProfile = false, isReco = false } = opts;
  const aud = audienceOf(c.audience);
  const dim = hasProfile && !matched && !isReco;
  return `
    <a class="content-item ${dim ? 'dimmed' : ''}" href="#/c/${c.id}">
      <div class="meta">
        <span class="tag ${matched ? 'match' : ''}">${isReco ? `${aud.emoji} ${esc(aud.name)}` : esc(tagLabel(c))}</span>
        <span class="pieces">🧩 ${c.pieces}조각${matched ? ' · 지금 나에게 맞는 글' : ''}</span>
      </div>
      <h3>${esc(c.title)}</h3>
    </a>`;
}

/* ---------- 글 페이지: md 로드 + 퍼즐 렌더링 ---------- */
async function renderArticle(id) {
  const c = contentOf(id);
  if (!c) { location.hash = '#/'; return; }
  const aud = audienceOf(c.audience);

  app.innerHTML = `
    <div class="track-head">
      <div class="crumb"><a href="#/">처음</a> · <a href="#/t/${c.audience}">${aud.emoji} ${esc(aud.name)}</a></div>
    </div>
    <article class="article"><p class="loading">퍼즐을 펼치는 중…</p></article>
    <div class="back-row"><button class="ghost" onclick="location.hash='#/t/${c.audience}'">← 목록으로</button></div>
  `;

  const articleEl = app.querySelector('.article');
  try {
    const md = await fetch(c.file).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
    // 글 안의 상대 md 링크를 SPA 라우트로 변환
    articleEl.innerHTML = marked.parse(md);
    articleEl.querySelectorAll('a[href$=".md"]').forEach(a => {
      const href = a.getAttribute('href');
      const target = DB.contents.find(x => {
        const slug = href.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
        return x.file.endsWith(slug) || x.file.endsWith('/' + slug.split('/').pop());
      });
      if (target) { a.setAttribute('href', `#/c/${target.id}`); }
    });
  } catch (e) {
    articleEl.innerHTML = `<p>이 글은 아직 준비 중입니다. (${esc(c.title)})</p>`;
  }

  // 하단 교차 추천
  const related = (c.related || []).map(contentOf).filter(Boolean);
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
  if (kind === 'c' && param) return renderArticle(decodeURIComponent(param));
  return renderHome();
}

window.addEventListener('hashchange', route);
route();
