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
  data/contents.json        ← 독자층·콘텐츠 레지스트리 (사이트가 읽는 단일 소스)
  data/levels.json          ← USA Swimming 공식 Motivational Standards (연령×성별×코스×종목)
  content/<audience>/*.md   ← 실제 글 (질문 제목 + 퍼즐 조각 + 다음 퍼즐 링크)

tools/
  build_levels.py           ← 공식 PDF → levels.json 재생성 스크립트 (quad 갱신 시 사용)
```

## 독자층 (1단계 선택)

| 키 | 네이밍 | 맞춤 방식 |
|---|---|---|
| swimmer | 🏊 물살을 가르는 선수 | 나이+성별+코스+종목+기록 입력 → USA Swimming 등급(B~AAAA) 판정 → 등급·연령대·성별 태그 매칭 |
| parent | 👨‍👩‍👧‍👦 선수 뒤의 부모 | 자녀 단계(S1~S4) 선택 |
| builder | 💻 만드는 사람 | 관심사(플랫폼/데이터/AI) 선택 |
| dreamer | 🌎 바다 건너를 꿈꾸는 사람 | 선택 없음 |

다른 트랙의 글은 숨기지 않고 "함께 보면 좋은 콘텐츠"로만 교차 추천된다 (아마존식).

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

## 콘텐츠 추가 방법

1. `docs/content/<audience>/<slug>.md` 작성 — 첫 줄은 `# 질문`, 본문은 `## 🧩 조각 N`, 끝에 `> 다음 퍼즐:` 링크
2. `docs/data/contents.json`의 `contents`에 등록 (`id`, `audience`, `tag`, `title`, `file`, `pieces`, `related`)
   - swimmer 글은 추가로 `levels`(예: `["A","AA"]`), `ages`(예: `["11-12","13-14"]`), `sex`(`all`/`F`/`M`)를 태깅 — 온보딩에서 판정된 프로필과 매칭되어 우선 노출된다
3. `brand/mindmap-content.md`에 질문 노드 추가
4. 새 경험이 근거라면 `brand/mindmap-me.md`, `brand/BRAND.md`도 갱신

## 로컬 미리보기

```bash
cd docs && python3 -m http.server 8000
# http://localhost:8000
```
