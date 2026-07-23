/* 시리즈 퍼즐: 실사 사진 + 지그소 렌더러.
 * 각 시리즈는 자기 폴더의 대표 사진(content/<트랙>/<퍼즐>/cover.jpg)을
 * 조각 수에 맞는 지그소 그리드로 자른다.
 *   6조각 → 3x2 · 8조각 → 4x2 · 10조각 → 5x2 (그 외는 2행 기준 자동 계산)
 * 글을 읽을 때마다 조각이 원본 사진으로 공개되고, 안 읽은 조각은 어둡고 흐린 실루엣으로 남는다.
 * sexed 퍼즐(olympic·champion)은 온보딩 성별에 따라 cover_M/cover_F로 바뀐다 (펠프스 / 레데키).
 * 사진 출처·라이선스는 각 puzzle.json의 credit → 시리즈 페이지 하단에 표기.
 * coverBase/sexed/credit는 tools/build_contents.py가 폴더를 스캔해 넣어 준다. */

(function () {
  const W = 300, H = 200;

  // 커버 사진 URL: series.coverBase(예: content/swimmer/olympic-ladder/cover)에
  // 성별 변형이면 _M/_F를, 아니면 그대로 .jpg를 붙인다.
  const imgUrl = (series, sex) => {
    const suffix = series.sexed ? `_${sex === 'F' ? 'F' : 'M'}` : '';
    return `${series.coverBase}${suffix}.jpg`;
  };
  // 시리즈 페이지 하단 출처 표기용 크레딧: sexed면 {M,F} 중 성별, 아니면 단일 객체.
  const creditFor = (series, sex) => {
    const cr = series.credit || {};
    return series.sexed ? (cr[sex === 'F' ? 'F' : 'M'] || {}) : cr;
  };

  function gridFor(n) {
    if (n <= 6) return { cols: 3, rows: 2 };
    if (n <= 8) return { cols: 4, rows: 2 };
    if (n <= 10) return { cols: 5, rows: 2 };
    return { cols: Math.ceil(n / 3), rows: 3 };
  }

  /* ---------- 지그소 조각 경로 ---------- */
  // 내부 경계선의 탭 방향(+1/-1)을 (col,row) 기준으로 결정적으로 배치
  const vtab = (row, innerCol) => ((row + innerCol) % 2 === 0 ? 1 : -1);
  const htab = (col, innerRow) => ((col + innerRow) % 2 === 0 ? 1 : -1);

  function edges(cols, rows) {
    const pw = W / cols, ph = H / rows;
    const tab = Math.min(pw, ph) * 0.19;
    function hEdge(x, y, dir, t) {
      if (!t) return `L ${x + dir * pw} ${y}`;
      const r = tab, mx = x + dir * pw / 2;
      const sweep = (t * dir) > 0 ? 0 : 1;
      return `L ${mx - dir * r} ${y} a ${r} ${r} 0 0 ${sweep} ${dir * 2 * r} 0 L ${x + dir * pw} ${y}`;
    }
    function vEdge(x, y, dir, t) {
      if (!t) return `L ${x} ${y + dir * ph}`;
      const r = tab, my = y + dir * ph / 2;
      const sweep = (t * dir) > 0 ? 1 : 0;
      return `L ${x} ${my - dir * r} a ${r} ${r} 0 0 ${sweep} 0 ${dir * 2 * r} L ${x} ${y + dir * ph}`;
    }
    return { pw, ph, hEdge, vEdge };
  }

  function piecePath(col, row, cols, rows) {
    const { pw, ph, hEdge, vEdge } = edges(cols, rows);
    const x0 = col * pw, y0 = row * ph;
    // 탭 부호는 절대 방향(+1 = 아래/오른쪽으로 볼록). 인접 조각이 같은 값을 쓰면
    // 진행 방향(dir)에 따라 sweep이 반전되어 동일한 경계 곡선을 공유한다.
    const top = row === 0 ? 0 : htab(col, row - 1);
    const bottom = row === rows - 1 ? 0 : htab(col, row);
    const left = col === 0 ? 0 : vtab(row, col - 1);
    const right = col === cols - 1 ? 0 : vtab(row, col);
    return `M ${x0} ${y0} ` +
      hEdge(x0, y0, 1, top) + ' ' +
      vEdge(x0 + pw, y0, 1, right) + ' ' +
      hEdge(x0 + pw, y0 + ph, -1, bottom) + ' ' +
      vEdge(x0, y0 + ph, -1, left) + ' Z';
  }

  /* ---------- 퍼즐 보드 렌더링 ----------
   * series: contents.json의 series 항목 · revealedSet: 공개된 조각 index Set
   * opts.sex: 'M'|'F' · opts.locked: 비활성(흑백) · opts.flash: 방금 공개된 조각 index · opts.uid: id 충돌 방지 */
  function render(series, revealedSet, opts = {}) {
    const n = series.articles.length;
    const { cols, rows } = gridFor(n);
    const uid = `pz-${series.id}${opts.uid || ''}`;
    const href = imgUrl(series, opts.sex);
    let defs = '', pieces = '';
    for (let i = 0; i < n; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const d = piecePath(col, row, cols, rows);
      const revealed = revealedSet.has(i);
      defs += `<clipPath id="${uid}-c${i}"><path d="${d}"/></clipPath>`;
      if (revealed) {
        const flash = opts.flash === i ? ' pz-flash' : '';
        pieces += `
        <g class="pz-piece pz-on${flash}" clip-path="url(#${uid}-c${i})"><use href="#${uid}-photo"/></g>
        <path d="${d}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.4"/>`;
      } else {
        pieces += `
        <g class="pz-piece pz-off" clip-path="url(#${uid}-c${i})">
          <use href="#${uid}-photo" opacity="0.22" filter="url(#${uid}-hide)"/>
          <path d="${d}" fill="rgba(8,13,24,0.55)"/>
        </g>
        <path d="${d}" fill="none" stroke="rgba(127,212,255,0.4)" stroke-width="1.2" stroke-dasharray="4 4"/>`;
      }
    }
    const lockedCls = opts.locked ? ' pz-locked' : '';
    return `
    <svg class="puzzle-svg${lockedCls}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${series.title} 퍼즐 진행도 ${revealedSet.size}/${n}">
      <defs>
        ${defs}
        <filter id="${uid}-hide"><feColorMatrix type="saturate" values="0.1"/><feGaussianBlur stdDeviation="2.2"/></filter>
        <image id="${uid}-photo" href="${href}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
      </defs>
      <rect width="${W}" height="${H}" fill="#0a101c"/>
      ${pieces}
    </svg>`;
  }

  /* ---------- 조각 하나의 썸네일 (시리즈 페이지 조각 카드용) ----------
   * 공개 전: 어두운 실루엣 + 조각 번호 · 공개 후: 그 조각 부분의 원본 사진 */
  function renderPiece(series, idx, revealed, opts = {}) {
    const n = series.articles.length;
    const { cols, rows } = gridFor(n);
    const col = idx % cols, row = Math.floor(idx / cols);
    const d = piecePath(col, row, cols, rows);
    const { pw, ph } = edges(cols, rows);
    const pad = Math.min(pw, ph) * 0.24; // 탭 돌출부가 잘리지 않게 여유
    const vb = `${col * pw - pad} ${row * ph - pad} ${pw + pad * 2} ${ph + pad * 2}`;
    const uid = `pp-${series.id}-${idx}${opts.uid || ''}`;
    const href = imgUrl(series, opts.sex);
    const photo = `<image href="${href}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`;
    return `
    <svg class="piece-thumb-svg ${revealed ? 'on' : 'off'}" viewBox="${vb}" role="img" aria-label="퍼즐 조각 ${idx + 1}${revealed ? ' (완성)' : ''}">
      <defs>
        <clipPath id="${uid}"><path d="${d}"/></clipPath>
        <filter id="${uid}-h"><feColorMatrix type="saturate" values="0.1"/><feGaussianBlur stdDeviation="2.4"/></filter>
      </defs>
      ${revealed
        ? `<g clip-path="url(#${uid})">${photo}</g>
           <path d="${d}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.6"/>`
        : `<g clip-path="url(#${uid})"><g filter="url(#${uid}-h)" opacity="0.3">${photo}</g>
           <path d="${d}" fill="rgba(8,13,24,0.5)"/></g>
           <path d="${d}" fill="none" stroke="rgba(127,212,255,0.45)" stroke-width="1.4" stroke-dasharray="4 4"/>`}
    </svg>`;
  }

  window.PUZZLE = { render, renderPiece, gridFor, imgUrl, creditFor };
})();
