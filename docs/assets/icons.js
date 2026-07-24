/* ============================================================
 * 아이콘 시스템 (ICON SYSTEM)
 * ------------------------------------------------------------
 * 제품 홈페이지 톤을 위해 이모지 대신 얇은 라인 SVG를 쓴다.
 * 모든 아이콘은 24×24 viewBox · stroke=currentColor · 라인 스타일로
 * 통일해 "한 벌의 시스템"으로 읽히게 한다. (Linear·Stripe·Vercel 계열)
 *
 * 사용:  icon('arrow')                → <svg …>  문자열
 *        productIcon('swim-capsule')  → 제품별 대표 아이콘
 *        trackIcon('swimmer')         → 독자 트랙 아이콘
 *        seriesIcon('first-lane')     → 시리즈(이야기 묶음) 아이콘
 * ============================================================ */
(function () {
  const P = 'stroke-linecap="round" stroke-linejoin="round"';
  // 각 아이콘은 <path>/<circle> 등 '내부 마크업'만 정의 (공통 svg 래퍼는 icon()이 씌운다)
  const D = {
    // ── UI ──
    arrow: `<path d="M5 12h14M13 6l6 6-6 6" ${P}/>`,
    arrowDown: `<path d="M12 5v14M6 13l6 6 6-6" ${P}/>`,
    chevronDown: `<path d="M6 9l6 6 6-6" ${P}/>`,
    back: `<path d="M19 12H5M11 6l-6 6 6 6" ${P}/>`,
    close: `<path d="M6 6l12 12M18 6L6 18" ${P}/>`,
    external: `<path d="M14 5h5v5M19 5l-8 8M11 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" ${P}/>`,
    github: `<path d="M9 19c-4 1.4-4-2.1-5.5-2.5M14.5 21v-3.3a2.9 2.9 0 0 0-.8-2.2c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6.2 0C5.3 2.8 4.3 3.1 4.3 3.1a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 2.9 9.5c0 4.6 2.8 5.7 5.5 6a2.9 2.9 0 0 0-.8 2.2V21" ${P}/>`,
    play: `<path d="M8 5.5v13l11-6.5-11-6.5Z" ${P}/>`,
    lock: `<rect x="5" y="11" width="14" height="9" rx="2" ${P}/><path d="M8 11V8a4 4 0 0 1 8 0v3" ${P}/>`,
    letter: `<rect x="3" y="5" width="18" height="14" rx="2" ${P}/><path d="M4 7l8 6 8-6" ${P}/>`,
    map: `<path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" ${P}/><path d="M9 4v14M15 6v14" ${P}/>`,
    compass: `<circle cx="12" cy="12" r="9" ${P}/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2Z" ${P}/>`,
    link: `<path d="M9 15l6-6M10 6l1-1a3.5 3.5 0 0 1 5 5l-1 1M14 18l-1 1a3.5 3.5 0 0 1-5-5l1-1" ${P}/>`,
    dot: `<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>`,
    spark: `<path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3Z" ${P}/>`,

    // ── 제품 ──
    vault: `<rect x="3" y="4" width="18" height="16" rx="2" ${P}/><circle cx="12" cy="12" r="4" ${P}/><path d="M12 8v1M12 15v1M8.5 12H9M15 12h.5" ${P}/>`,
    stopwatch: `<circle cx="12" cy="13" r="8" ${P}/><path d="M12 13V9M9 2h6M18.5 6.5l1.5-1.5" ${P}/>`,
    board: `<rect x="4" y="4" width="16" height="17" rx="2" ${P}/><path d="M9 3h6v3H9zM8 11h8M8 15h5" ${P}/>`,
    pen: `<path d="M15 4l5 5L8 21H3v-5L15 4Z" ${P}/><path d="M13 6l5 5" ${P}/>`,

    // ── 독자 트랙 ──
    wave: `<path d="M3 9c2.2 0 2.2 2.2 4.5 2.2S9.7 9 12 9s2.2 2.2 4.5 2.2S18.8 9 21 9M3 15c2.2 0 2.2 2.2 4.5 2.2S9.7 15 12 15s2.2 2.2 4.5 2.2S18.8 15 21 15" ${P}/>`,
    family: `<circle cx="8" cy="8" r="3" ${P}/><circle cx="17" cy="9" r="2.3" ${P}/><path d="M3 20v-1a5 5 0 0 1 10 0v1M15 20v-1a4 4 0 0 1 6-3.4" ${P}/>`,
    code: `<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" ${P}/>`,
    globe: `<circle cx="12" cy="12" r="9" ${P}/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" ${P}/>`,
    trophy: `<path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" ${P}/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M10 14h4M9 20h6M12 12v2" ${P}/>`,
    flag: `<path d="M6 21V4M6 4h11l-2 3 2 3H6" ${P}/>`,
    ladder: `<path d="M8 3v18M16 3v18M8 7h8M8 12h8M8 17h8" ${P}/>`,
    bag: `<path d="M4 8h16l-1 12H5L4 8Z" ${P}/><path d="M9 8V6a3 3 0 0 1 6 0v2" ${P}/>`,
    layers: `<path d="M12 3l9 5-9 5-9-5 9-5Z" ${P}/><path d="M3 13l9 5 9-5" ${P}/>`,
    chip: `<rect x="6" y="6" width="12" height="12" rx="2" ${P}/><path d="M9 6V3M15 6V3M9 21v-3M15 21v-3M6 9H3M6 15H3M21 9h-3M21 15h-3" ${P}/>`,
    bridge: `<path d="M3 16v-3a9 9 0 0 1 18 0v3M3 16h18M8 16v-4M16 16v-4M12 16v-6" ${P}/>`,
    lens: `<circle cx="12" cy="12" r="9" ${P}/><circle cx="12" cy="12" r="3.4" ${P}/><path d="M12 3v3M12 18v3M3 12h3M18 12h3" ${P}/>`,
  };

  const icon = (name, cls) => {
    const inner = D[name];
    if (!inner) return '';
    return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">${inner}</svg>`;
  };

  const PRODUCT = { 'swim-capsule': 'vault', splitlane: 'stopwatch', 'swim-meets': 'board', 'tutor-writing': 'pen' };
  const TRACK = { swimmer: 'wave', parent: 'family', builder: 'code', dreamer: 'globe', writer: 'pen' };
  const SERIES = {
    'first-lane': 'wave', 'race-craft': 'spark', 'american-lanes': 'flag',
    'olympic-ladder': 'ladder', 'champion-code': 'trophy',
    'parent-seasons': 'family', 'away-meets': 'bag',
    'three-devs': 'globe', 'data-to-ai': 'layers', 'builder-origin': 'chip',
    'athlete-data-platform': 'vault', 'pacific-bridge': 'bridge',
    'writing-tutor': 'pen',
  };

  window.SITE_ICONS = {
    icon,
    has: (n) => !!D[n],
    product: (key, cls) => icon(PRODUCT[key] || 'spark', cls),
    track: (t, cls) => icon(TRACK[t] || 'spark', cls),
    series: (id, cls) => icon(SERIES[id] || 'spark', cls),
  };
})();
