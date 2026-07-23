# 퍼스널 브랜딩 — 데이터를 만들고, 선수를 키웁니다

차량 데이터 플랫폼을 만들어온 엔지니어이자 두 수영 선수를 키우는 아빠의 퍼스널 브랜딩 저장소.
모든 콘텐츠는 **질문에서 출발**하고, **퍼즐처럼 조각을 맞추는 방식**으로 제공된다.

## 구조

```
brand/                      ← 브랜드의 원천 (md, 지속 업데이트)
  BRAND.md                  ← 브랜드 코어: 포지셔닝, 3기둥, 콘텐츠 원칙, 업데이트 규칙
  mindmap-me.md             ← 마인드맵 ①: 나 중심 (커리어/개인/가족) — Mermaid
  mindmap-content.md        ← 마인드맵 ②: 콘텐츠(독자) 중심 — 사이트 IA의 원본

docs/                       ← GitHub Pages 사이트 (정적 SPA)
  index.html
  assets/style.css, app.js
  assets/puzzles.js         ← 실사 사진 지그소 렌더러 (6/8/10조각 가변 그리드 + 조각 썸네일)
  data/contents.json        ← 빌드 산출물 (tools/build_contents.py가 content/ 폴더에서 자동 생성)
  data/levels.json          ← USA Swimming 공식 Motivational Standards (연령×성별×코스×종목)
  content/audiences.json    ← 독자층(트랙) 정의
  content/<트랙>/<퍼즐>/     ← 퍼즐 하나 = 폴더 하나 (원천 소스)
    puzzle.json             ← 퍼즐 메타(제목·질문·활성화조건·사진 출처)
    cover.jpg               ← 대표 이미지 (성별 변형: cover_M.jpg / cover_F.jpg)
    NN-<slug>.md            ← 글. 앞 두 자리 번호가 조각 순서. 파일 수 = 조각 수

tools/
  build_contents.py         ← content/ 폴더 스캔 → contents.json 생성 (배포 시 자동 실행)
  build_levels.py           ← 공식 PDF → levels.json 재생성 스크립트 (quad 갱신 시 사용)
```

> **콘텐츠는 폴더가 원천이다.** 이미지·글·메타가 퍼즐 폴더 한곳에 모여 있어,
> 이미지를 바꾸려면 그 폴더의 `cover.jpg`를 교체하고, 조각을 늘리려면 `07-….md`처럼
> 다음 번호의 글을 추가하면 된다 — `contents.json`은 배포 때 자동 재생성된다.

## 독자층 (1단계 선택)

| 키 | 네이밍 | 맞춤 방식 |
|---|---|---|
| swimmer | 🏊 물살을 가르는 선수 | 나이+성별+코스+종목+기록 입력 → USA Swimming 등급(B~AAAA) 판정 → 등급·연령대·성별 태그 매칭 |
| parent | 👨‍👩‍👧‍👦 선수 뒤의 부모 | 자녀 단계(S1~S4) 선택 |
| builder | 💻 만드는 사람 | 관심사(플랫폼/데이터/AI) 선택 |
| dreamer | 🌎 바다 건너를 꿈꾸는 사람 | 선택 없음 |

다른 트랙의 글은 숨기지 않고 "함께 보면 좋은 콘텐츠"로만 교차 추천된다 (아마존식).

## 퍼즐 시리즈 (2단계 선택)

트랙 안의 콘텐츠는 **시리즈 = 퍼즐 한 판**으로 묶인다. 판 크기는 책 시리즈처럼 다양하다
(6조각 = 3×2, 8조각 = 4×2, 10조각 = 5×2). 글 하나를 읽으면 실사 사진 위의 지그소 조각이
하나 열린다 (`localStorage: pb-read`). 전부 맞추면 사진 전체와 🏆 배지가 나타난다.

- **실사 퍼즐**: 각 시리즈는 Wikimedia Commons의 실제 사진(`assets/img/<art>.jpg`)을 지그소로 자른다.
  출처·라이선스는 `assets/img/credits.json`에 있고 시리즈 페이지 하단에 자동 표기된다.
- **활성화**: 시리즈는 온보딩 프로필과 매칭되어 켜진다 — swimmer는 판정 등급(`unlock.levels`),
  parent는 자녀 단계(`unlock.stages`), builder는 관심사(`unlock.interests`). 매칭되지 않는 시리즈는
  흐리게 보이지만 읽을 수는 있다 (숨기지 않는 원칙 유지).
- **사진 변형**: 🥇 올림픽 사다리와 🔥 챔피언의 코드는 온보딩 성별에 따라 사진이 바뀐다
  (남자 = 마이클 펠프스, 여자 = 케이티 레데키 — `<art>_M.jpg` / `<art>_F.jpg`).
- **온보딩 최소화**: 레벨 판정이 끝나면 입력 폼은 등급 칩 한 줄로 접히고 퍼즐 보드가 화면의 주인공이 된다.

| 트랙 | 시리즈 (조각 수) |
|---|---|
| 🏊 swimmer | 🌊 첫 물살을 가르다(6) · ⚡ 레이스는 디테일이다(8) · 🇺🇸 아메리칸 레인(6) · 🥇 올림픽으로 가는 사다리(6, AAA+) · 🔥 챔피언의 코드(6, AAA+) |
| 👨‍👩‍👧‍👦 parent | 🧭 부모의 사계절(8) · 🎒 원정의 기술(6) |
| 💻 builder | 🛠️ 3인의 글로벌 플랫폼(6) · 📊 데이터에서 AI로(10) · 💾 엔지니어의 성장기(6) |
| 🌎 dreamer | 🌉 태평양 브릿지(8) |

## 테마 파라미터 (주제별 노출)

수영 독자와 개발자 독자는 층이 완전히 달라서, URL 파라미터로 한 주제만 노출할 수 있다.

| URL | 노출 트랙 |
|---|---|
| `/` (기본) | 전체 (swimmer·parent·builder·dreamer) |
| `/?theme=swim` | 🏊 수영: swimmer·parent·dreamer |
| `/?theme=dev` | 💻 개발자: builder·dreamer |

dreamer(해외살이)는 두 주제를 잇는 브릿지라 양쪽 모두에 포함된다.
테마가 켜지면 홈 히어로 문구, 트랙 목록, 교차 추천, 글 안의 md 링크까지 해당 주제로 필터링된다.

## GitHub Pages 배포

`main`에 푸시하면 GitHub Actions(`.github/workflows/deploy-pages.yml`)가 `docs/`를 자동 배포한다.
사이트: `https://<username>.github.io/<repo>/`

### 캐시 버스팅 (새 버전 즉시 반영)

GitHub Pages는 모든 파일을 10분간 캐시(`max-age=600`)하므로, 배포 시 워크플로우가
`index.html`의 `__BUILD_VERSION__` 플레이스홀더를 **커밋 해시로 치환**한다.

- `style.css` / `app.js`는 `?v=<해시>`로 로드 → 새 배포마다 URL이 바뀌어 즉시 새로 받음
- `app.js`는 `contents.json` / `levels.json` / 글 md도 같은 버전으로 fetch
- 남는 것은 `index.html` 자체의 캐시(최대 10분)뿐이며, 이것이 갱신되는 순간 모든 리소스가 새 버전으로 일괄 전환된다 (버전 불일치 없음)

로컬 미리보기에서는 플레이스홀더가 치환되지 않아 `v=dev`로 동작한다.

## 수영 레벨 체계 (USA Swimming 공식)

`docs/data/levels.json`은 **USA Swimming 2024–2028 Motivational Time Standards (Age Group)** 공식 PDF에서 추출했다.

- 판정 축: 연령대(10&U/11-12/13-14/15-16/17-18) × 성별(Girls/Boys) × 코스(SCY/SCM/LCM) × 종목
- 등급: `PRE_B` → **B → BB → A → AA → AAA → AAAA** → `AAAA_PLUS`(챔피언십 트랙 후보)
- AAAA 위 사다리: Sectionals → Futures → Junior Nationals → Nationals → Olympic Trials (대회별 커트는 [공식 페이지](https://www.usaswimming.org/times/time-standards) 참조)
- 새 quad 기준 발표 시 재생성:

```bash
# 공식 사이트에서 Motivational Standards (Age Group) PDF 다운로드 후
python3 tools/build_levels.py <다운로드한.pdf>
```

## 콘텐츠 추가 / 수정 방법

모든 편집은 **퍼즐 폴더 하나 안에서** 끝난다. 끝나면 빌드 스크립트를 한 번 돌린다.

**조각(글) 추가 — 예: 6조각 퍼즐을 8조각으로**

1. 대상 폴더에 다음 번호의 글을 만든다: `docs/content/<트랙>/<퍼즐>/07-<slug>.md`
   - 상단에 frontmatter, 이어서 `# 질문` 제목, 본문 `## 🧩 조각 N`, 끝에 `> 다음 퍼즐:` 링크
   ```
   ---
   id: swimmer-new-topic     # <트랙>-<슬러그>. 상호 링크 매칭 기준 (유일해야 함)
   tag: A–AA
   pieces: 3
   levels: [A, AA]           # swimmer 전용: 온보딩 등급과 매칭 (parent/builder는 생략)
   ages: [13-14, 15-16]
   sex: all
   related: [parent-race-day-food]
   ---
   ```
2. `python3 tools/build_contents.py` 실행 — 파일 수가 곧 조각 수라, 8개가 되면 그리드가 자동으로 4×2가 된다.
   (배포 시 워크플로우가 자동 실행하므로, 커밋만 해도 반영된다.)

**이미지 교체** — 그 폴더의 `cover.jpg`(또는 `cover_M.jpg`/`cover_F.jpg`)를 새 파일로 덮어쓴다.
출처는 `puzzle.json`의 `credit`에 적는다.

**새 퍼즐(시리즈) 만들기** — `docs/content/<트랙>/<새퍼즐>/` 폴더를 만들고 `puzzle.json` + `cover.jpg` + `01-…md`부터 넣는다.
성별 변형이 필요하면 `cover_M.jpg`/`cover_F.jpg`를 두면 빌드가 자동으로 `sexed`로 인식한다(코드 수정 불필요).

**puzzle.json 형식**
```json
{
  "order": 0,                     // 트랙 안에서의 노출 순서
  "emoji": "🌊",
  "title": "첫 물살을 가르다",
  "question": "취미가 선수로 바뀌는 순간, 무엇이 필요할까?",
  "unlock": { "levels": ["PRE_B", "B", "BB"] },   // {} = 항상 활성 / stages / interests
  "unlockLabel": "PRE_B–BB 레벨에서 활성화",
  "credit": { "artist": "...", "license": "...", "source": "..." }
}
```

마지막으로 `brand/mindmap-content.md`에 질문 노드를 추가하고, 새 경험이면 `brand/mindmap-me.md`·`brand/BRAND.md`도 갱신한다.

## 로컬 미리보기

```bash
python3 tools/build_contents.py          # 폴더 → contents.json
cd docs && python3 -m http.server 8000    # http://localhost:8000
```
