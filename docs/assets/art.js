/* ============================================================
 * 사진 설정 (PHOTO CONFIG)
 * ------------------------------------------------------------
 * 사진을 교체하려면 이 파일의 경로만 바꾸면 됩니다.
 * To replace photos, edit only the paths in this file.
 *
 * - 경로는 docs/ 기준 상대 경로 (예: content/.../cover.jpg 또는 assets/img/my.jpg)
 * - 권장: 가로 1600px 이상 JPG. hero는 어두운 톤이 타이포와 잘 어울립니다.
 * - 새 사진을 쓰려면 docs/assets/img/ 폴더를 만들어 넣고 경로를 지정하세요.
 * ============================================================ */
window.SITE_ART = {
  /* 홈 인트로 배경 */
  home: 'content/swimmer/first-lane/cover.jpg',
  /* '서비스가 태어난 이야기' 허브 배경 */
  stories: 'content/builder/data-to-ai/cover.jpg',

  /* 서비스별: hero(대표) · problem(문제 장면) · origin(기원 장면) */
  products: {
    swimvault: {
      hero: 'content/swimmer/american-lanes/cover.jpg',
      problem: 'content/swimmer/first-lane/cover.jpg',
      origin: 'content/dreamer/pacific-bridge/cover.jpg',
    },
    splitlane: {
      hero: 'content/swimmer/race-craft/cover.jpg',
      problem: 'content/swimmer/champion-code/cover_M.jpg',
      origin: 'content/builder/builder-origin/cover.jpg',
    },
    'swim-meets': {
      hero: 'content/parent/away-meets/cover.jpg',
      problem: 'content/parent/parent-seasons/cover.jpg',
      origin: 'content/builder/data-to-ai/cover.jpg',
    },
  },
};
