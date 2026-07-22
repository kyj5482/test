# 마인드맵 ② — 콘텐츠 중심 (Audience-Centered Mindmap)

> 실제 **사용자(독자)**를 뿌리로 하는 지도. 웹사이트의 정보 구조(IA)가 이 파일을 그대로 따른다.
> 독자는 자신의 트랙 콘텐츠를 소비하고, 다른 트랙은 "함께 보면 좋은 콘텐츠"로만 추천된다 (아마존식).

## 독자층 (1단계 선택지)

| 키 | 사용자 친화적 네이밍 | 누구인가 | 맞춤 요소 |
|---|---|---|---|
| `swimmer` | 🏊 **물살을 가르는 선수** | 수영 선수 (유소년~학생 선수) | 나이+성별+코스+종목+기록 입력 → USA Swimming 공식 등급(B~AAAA) 판정 → 등급·연령대·성별 태그 매칭 |
| `parent` | 👨‍👩‍👧‍👦 **선수 뒤의 부모** | 선수(지망) 자녀를 둔 부모 | 자녀 단계(입문/선수등록/전국대회/해외) 선택 |
| `builder` | 💻 **만드는 사람** | 개발자·플랫폼 엔지니어 | 관심사(플랫폼/데이터/AI) 선택 |
| `dreamer` | 🌎 **바다 건너를 꿈꾸는 사람** | 미국 이주·주재원·해외살이 관심층 | 상황(여행/주재원/이민) 선택 |

```mermaid
mindmap
  root((콘텐츠))
    swimmer["🏊 물살을 가르는 선수"]
      온보딩: 나이+성별+코스+종목+기록 → USA Swimming 등급 판정
      PRE_B·B 기초 다지기~대회 입문
        Q: 잘못 배운 폼, 다 무너뜨리고 다시 시작해야 할까?
      B·BB 대회 입문~성장 가속
        Q: 대회에서 결승에 못 가면 실패일까?
        Q: 결승에 8위로라도 올라가야 하는 이유는?
      A·AA 경쟁 진입~상위 경쟁
        Q: 주종목이 아닌 종목으로 입상할 수 있을까?
      AAA·AAAA 전국 지향~최상위
        Q: 한국 훈련과 미국 훈련은 무엇이 다를까?
      AAAA+ 챔피언십 트랙
        Sectionals → Futures → Jr Nationals → Nationals → Olympic Trials
      추천: parent 트랙, 기록 앱
    parent["👨‍👩‍👧‍👦 선수 뒤의 부모"]
      단계1 시작 전
        Q: 영어유치원 대신 운동을 시키면 뒤처지는 걸까?
      단계2 선수 등록 결정
        Q: 선수 등록, 언제 어떻게 결정해야 할까?
      단계3 대회의 시간
        Q: 대회 원정을 아이의 선물로 만들 수 있을까?
      단계4 해외 도전
        Q: 아이의 수영을 위해 나라를 옮긴다는 것은?
      추천: swimmer 트랙, dreamer 트랙
    builder["💻 만드는 사람"]
      플랫폼
        Q: 3명이 어떻게 글로벌 커넥티드카 플랫폼을 만들었나?
        Q: 3개 브랜드의 계정을 6개월 만에 통합할 수 있을까?
      데이터
        Q: 매일 100만 대에서 수집하는데 왜 하루 1대도 분석 못할까?
        Q: 디지털 트윈은 어디까지가 현실일까? (Vehicle Twin)
      AI
        Q: 1일 1앱은 어떻게 가능한가? (AI 마이크로앱)
        Q: 누구나 데이터 앱을 배포하는 앱스토어는 어떻게 만드나?
      추천: dreamer 트랙 (실리콘밸리·주재원)
    dreamer["🌎 바다 건너를 꿈꾸는 사람"]
      여행에서 시작
        Q: 2006년, 지도 없이 미국 20일을 어떻게 여행했나?
      해외 근무
        Q: 실리콘밸리 파견 6개월은 무엇을 남겼나?
        Q: 스타트업비자 vs 주재원, 무엇을 선택해야 할까?
      가족과 정착
        Q: 아이들은 미국 훈련에 어떻게 적응했나?
      추천: parent 트랙, builder 트랙
```

## 레벨 판정 (swimmer 트랙) — USA Swimming 공식 기준

기준 데이터는 [docs/data/levels.json](../docs/data/levels.json).
**USA Swimming 2024–2028 Motivational Time Standards (Age Group)** 공식 PDF에서 추출한 값으로,
연령대(10&U / 11-12 / 13-14 / 15-16 / 17-18) × 성별(Girls/Boys) × 코스(SCY/SCM/LCM) × 종목별로
**B → BB → A → AA → AAA → AAAA** 등급을 판정한다.

- B 기준보다 느리면 `PRE_B`(기초 단계), AAAA 기준을 여유 있게 넘으면 `AAAA_PLUS`(챔피언십 트랙 후보).
- AAAA 위는 대회 커트 기반 사다리: **Sectionals → Futures → Junior Nationals → Nationals → Olympic Trials** (커트는 대회·연도마다 다르므로 [공식 페이지](https://www.usaswimming.org/times/time-standards)에서 확인).
- 기준은 4년 주기(quad)로 갱신되므로 새 기준 발표 시 `levels.json`을 재생성한다 (README의 갱신 절차 참조).

## 콘텐츠 등록 규칙

1. 글은 `docs/content/<audience>/<slug>.md`로 작성. 제목은 반드시 **질문**.
2. frontmatter 없이 첫 줄 `# 질문`, 마지막에 `> 다음 퍼즐: ...` 링크.
3. `docs/data/contents.json`에 등록. swimmer 글은 `levels`(등급 배열), `ages`(연령대 배열), `sex`(`all`/`F`/`M`)를 태깅해 맞춤 노출에 사용.
4. `related`에는 다른 트랙 글 id를 넣어 교차 추천에 사용.
