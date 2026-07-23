# CLAUDE.md

퍼스널 브랜딩 정적 사이트(GitHub Pages) 저장소. 이 파일은 Claude Code가 이 저장소에서
일할 때 반드시 지켜야 하는 규칙이다.

## 프로젝트 구조 (한눈에)

- `docs/` — 배포되는 정적 사이트(SPA). `assets/app.js`가 라우팅·렌더링.
- `docs/content/<트랙>/<퍼즐>/` — **콘텐츠의 원천**. 퍼즐 하나 = 폴더 하나.
  - `NN-<slug>.md` — 글. 앞 두 자리 번호가 조각 순서.
  - `puzzle.json` — 퍼즐 메타(제목·질문·활성화조건·사진 출처).
  - `cover.jpg`(또는 `cover_M/_F.jpg`) — 대표 이미지.
- `docs/content/products.json` — **제품(브랜드) 3종의 원천**. GitHub에서 개발 중인 앱을
  서비스로 소개한다. 각 feature의 `stories`는 퍼즐 글 id — "이 기능은 이 이야기에서
  태어났다"는 스토리→Feature 연결. 없는 id를 가리키면 빌드 오류.
- `docs/content/newsletters/NN.md` — **뉴스레터 원천**. 퍼즐 스토리 요약+링크로 구성.
  frontmatter `status: published`인 호만 사이트에 실린다(초안은 `draft`). 앱 출시·버전
  업그레이드에 맞춰 published로 바꿔 발행한다. 필드: `id`·`date`·`product`(products.json의
  key)·`version`·`stories`(글 id 목록)·`prompt`.
- `docs/data/contents.json` — **산출물**. `tools/build_contents.py`가 폴더를 스캔해 생성.
  절대 손으로 고치지 않는다. 편집 후 `python3 tools/build_contents.py` 실행(배포 시 자동).
- `brand/` — 브랜드 헌법(`BRAND.md`)과 마인드맵 두 개. 새 콘텐츠를 만들면 함께 업데이트.

메인 테마: **"AI/데이터로 유스 스포츠 성장을 기록·분석하는 아빠 개발자."** 사이트는
제품 홈페이지다 — 기능은 그냥 만들지 않는다. 먼저 "왜?"라는 질문·문제를 퍼즐 스토리로
쓰고(planned→published), `products.json`의 feature `stories`에 그 글을 연결한다.
글 하단에는 "이 이야기에서 태어난 기능"이, 제품 페이지에는 기능별 기원 스토리가 노출된다.

배포: `main`에 push하면 `.github/workflows/deploy-pages.yml`가 빌드 후 Pages에 올린다.
CI에는 PyYAML이 없을 수 있으므로 `build_contents.py`의 폴백 YAML 파서가 실제로 도는
경로다 — frontmatter를 이 파서가 못 읽는 형식으로 쓰지 말 것.

## 글(md) frontmatter 규칙

글 상단 YAML frontmatter(`--- … ---`)는 **빌드 전용 메타데이터**이며 화면에 노출되지 않는다
(`app.js`가 렌더 직전에 frontmatter 블록을 통째로 제거한다). 필드:

```yaml
---
id: builder-athlete-why-log      # 콘텐츠 고유 id(<트랙>-<슬러그>). 상호 링크·related 매칭 기준
tag: data                        # 카드에 표시되는 짧은 태그
pieces: 3                        # 글 내부 소단락(조각) 개수 표시용
levels: [PRE_B, B]               # (swimmer 전용) 우선 노출 등급
ages: [10U, 11-12]               # (swimmer 전용) 연령대
sex: all                         # (swimmer 전용) all | M | F
related: [swimmer-record-updown] # 교차 추천 대상 콘텐츠 id
status: published                # (선택) 글의 생애주기 상태. 생략하면 published. 아래 표 참조
publish: 2026-08-15              # (planned 권장) 게시 예정일. 프론트가 '○월 ○일 공개 예정'으로 표시
prompt: |                        # 이 글의 원천이 된 나의 프롬프트. 절대 화면에 노출 안 됨
  실제 프롬프트를 여기에. 여러 줄 가능.
---

# 제목은 본문 첫 H1에서 가져온다 (제목의 단일 출처)
```

### ⭐ 프롬프트 기록 규칙 (필수)

이 사이트의 글은 **작성자의 프롬프트에서 출발**한다. 그 원천 프롬프트를 글과 함께 보존하되
독자에게는 보이지 않게 한다.

1. **모든 글은 frontmatter에 `prompt:` 블록을 가진다.** 형식은 반드시 `prompt: |` 뒤에
   들여쓰기된 여러 줄(YAML block scalar). 폴백 파서가 이 형식을 기준으로 프롬프트 본문이
   다른 키를 침범하지 않게 처리한다.
2. **프롬프트는 절대 본문(H1 아래)에 쓰지 않는다.** 오직 frontmatter `prompt:`에만 둔다.
   `app.js`가 frontmatter를 제거하므로 화면·DOM 어디에도 프롬프트가 남지 않는다.
3. 규칙 도입 전 작성돼 원본 프롬프트를 모르는 글은 `prompt:`에 "미기록" placeholder가 들어 있다.
   그 글을 재작성·보강할 때 실제 프롬프트로 교체한다.

### ⭐ status 값 (글의 생애주기)

`build_contents.py`가 검증하는 값은 세 가지. 생략하면 `published`로 본다. 그 외 값은 빌드 오류.

| 값 | 사이트 | 의미 | 재작성 명령 대상? |
|---|---|---|---|
| `published` | 노출·클릭 가능 | 본문 완성·게시됨(기본값) | ✕ |
| `planned` | **노출·클릭 차단** | 프롬프트만 있고 본문 미작성. '게시 예정'으로 표시 | ○ (본문 신규 작성) |
| `revise` | 노출·클릭 가능 | 게시됐지만 **프롬프트를 수정함** → 본문 재생성 필요 | ○ (본문 재작성) |

- `planned`: 발굴해둔 퍼즐/조각에 제목·질문·프롬프트만 먼저 넣어두는 상태. **contents.json에는
  실리되**(사용자가 클릭 전에 뭐가 올지 알 수 있도록), 프론트가 **클릭을 막고 `publish` 날짜를
  '○년 ○월 ○일 공개 예정'으로 표시**한다. 조각(사진)도 열리지 않는다.
  - **`publish: YYYY-MM-DD`** 게시 예정일을 함께 둔다(권장). 없으면 '작성 중 · 공개 예정'으로만
    뜨고 빌드가 "게시일 미정" 경고를 낸다.
  - 최소 구성: frontmatter의 `id`·`tag`·`prompt`·`publish` + 본문 H1 제목 + 질문 한 줄.
  - 한 퍼즐의 글이 전부 planned여도 그 퍼즐은 '게시 예정 조각'만으로 사이트에 노출된다.
    커버 사진이 아직 없으면(`hasCover:false`) 프론트가 사진 대신 은은한 플레이스홀더를 그린다.
- `revise`: **이미 게시된 글의 프롬프트를 작성자가 고쳤을 때** 다는 표시. 헌 본문은 그대로
  노출되지만, 빌드가 "재작성 대기" 목록에 찍어주고 재작성 명령의 대상이 된다. 즉 "프롬프트가
  바뀌었으니 본문을 다시 만들어달라"는 신호다.

## 🪄 명령: "프롬프트가 있지만 (미)작성해야 할 글을 작성/갱신하라"

작성자가 이렇게 지시하면 다음 절차를 따른다:

1. **대상 수집**: `docs/content/**/NN-*.md` 중 아래 둘을, `prompt:` 블록에 실제 프롬프트가
   채워진 것(= "미기록/미작성" placeholder가 아닌 것)만 모은다. placeholder뿐이면 **건너뛴다**.
   - `status: planned` → 본문을 **새로** 쓴다.
   - `status: revise` → 수정된 프롬프트에 맞춰 본문을 **다시** 쓴다(기존 본문은 대체 대상).
2. **작성**: 각 글에 대해 frontmatter의 `prompt:` 내용을 지시로 삼아 본문을 쓴다.
   - 본문은 기존 글의 형식을 따른다: `# 질문형 제목`(H1) → `` `주제 태그` · `퍼즐 N조각` ``
     라인 → `## 🧩 조각 N — …` 소제목들 → 마지막에 `> **다음 퍼즐 →** [제목](다음파일.md)` 링크.
   - **경험 기반 원칙**(BRAND.md §4-5): 이론이 아니라 작성자가 겪은 일로 쓴다. 프롬프트에
     담긴 사실만 사용하고, 모르는 사실을 지어내지 않는다. 불확실하면 작성자에게 확인한다.
   - 같은 퍼즐 폴더 내 앞뒤 글과 사실이 모순되지 않는지 점검한다.
3. **게시로 전환**: 본문을 채운/갱신한 글의 `status`를 `published`로 바꾼다(줄을 지워도 됨).
   planned이었다면 `publish:` 예정일 줄도 지운다(이미 게시되므로 불필요). `prompt:` 블록은
   그대로 남겨 보존한다. 커버 사진이 아직 없으면 `puzzle.json` 크레딧과 `cover.jpg`도 챙긴다.
4. **빌드·검증**: `python3 tools/build_contents.py`를 실행하고 BUILD ERRORS가 없는지,
   "재작성 대기(revise)" 목록이 비었는지, 프롬프트 텍스트가 산출물에 새지 않았는지 확인한다.
5. **마인드맵 갱신**: 새로 게시된 글이 마인드맵에 반영돼 있는지 `brand/mindmap-content.md`
   확인(계획 단계에서 이미 넣었다면 "(계획 중)" 표기만 제거).

작성자가 특정 퍼즐/글만 지정하면 그 범위로 한정한다. 지정이 없으면 위 1번의 전체 대상을
작성하되, 많으면 퍼즐 단위로 나눠 진행 상황을 보고한다.

## 편집 후 항상

- 콘텐츠(글·puzzle.json·audiences.json)를 바꿨으면 `python3 tools/build_contents.py` 실행.
- 새 경험/글이 생기면 `brand/BRAND.md` 근거 표와 `brand/mindmap-*.md`를 함께 업데이트(§6 규칙).
- `docs/data/contents.json`은 산출물이니 직접 편집하지 않는다.
