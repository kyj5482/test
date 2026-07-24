/* ============================================================
 * 사진 설정 (PHOTO CONFIG)
 * ------------------------------------------------------------
 * 사진을 교체하려면 이 파일의 경로만 바꾸면 됩니다.
 * To replace photos, edit only the paths in this file.
 *
 * - 경로는 docs/ 기준 상대 경로 (예: content/.../cover.jpg 또는 assets/img/my.jpg)
 * - 권장: 가로 1600px 이상 JPG. hero는 어두운 톤이 타이포와 잘 어울립니다.
 * - 아래 서비스 배경은 장면 주제에 맞춰 Wikimedia Commons에서 선별한 사진.
 *   출처·저작자·라이선스는 docs/assets/img/CREDITS.md 에 보존한다(교체 시 함께 갱신).
 * ============================================================ */
window.SITE_ART = {
  /* 홈 인트로 배경 — 물살을 가르는 수중 자유형(시네마틱). 사이트 전체의 첫인상 */
  home: 'assets/img/svc-home-underwater.jpg',
  /* '서비스가 태어난 이야기' 허브 배경 — 텅 빈 관중석에서 내려다본 경기 수영장 */
  stories: 'assets/img/svc-stories-natatorium.jpg',

  /* 서비스별: hero(대표) · problem(문제 장면) · origin(기원 장면) */
  products: {
    'swim-capsule': {
      // hero: 텅 빈 경기 레인 — 원본을 담아두는 타임캡슐의 차분한 여백
      hero: 'assets/img/svc-comp-pool.jpg',
      // problem: 물이 빠진 폐수영장 — "원본 사이트가 닫히면 기록은 사라진다"는 문제
      problem: 'assets/img/svc-capsule-vanish.jpg',
      // origin: 노트에 손으로 기록하는 장면 — 내 아이의 기록을 직접 남기기 시작한 기원
      origin: 'assets/img/svc-capsule-log.jpg',
    },
    splitlane: {
      // hero: 힘이 실린 접영 순간 — 1/100초를 재는 훈련 타이머의 세계
      hero: 'assets/img/svc-splitlane-fly.jpg',
      // problem: 인접 레인의 두 선수 — 여러 아이를 한 번에 재야 하는 문제
      problem: 'assets/img/svc-splitlane-lanes.jpg',
      // origin: 턴/스플릿의 결정적 순간 — 스타트/턴/스플릿 타이머의 세계
      origin: 'assets/img/svc-splitlane-turn.jpg',
    },
    'swim-meets': {
      // hero: 대형 경기장 파노라마 — 대회의 무대
      hero: 'assets/img/svc-meets-arena.jpg',
      // problem: 관중석을 가득 메운 대회 — 수천 명 psych sheet 속 내 아이 찾기
      problem: 'assets/img/svc-meets-crowd.jpg',
      // origin: 화면 위 코드 — PDF를 파싱해 조회하게 만든 엔지니어링 기원
      origin: 'assets/img/svc-meets-parse.jpg',
    },
    'tutor-writing': {
      // hero: 책상에서 매일 글을 쓰는 아이 — "매일 쓰는 아이"의 세계
      hero: 'assets/img/svc-writing-child.jpg',
      // problem: 빈 노트 한 장 — 매일 쓸 데도, 봐줄 사람도 없는 빈 화면의 문제
      problem: 'assets/img/svc-writing-blank.jpg',
      // origin: 책과 노트북이 놓인 공부 공간 — 읽은 책으로 쓰는 AI 튜터의 기원
      origin: 'assets/img/svc-writing-books.jpg',
    },
  },
};
