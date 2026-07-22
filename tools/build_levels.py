#!/usr/bin/env python3
"""USA Swimming Motivational Time Standards PDF → docs/data/levels.json 생성기.

사용법:
  1. https://www.usaswimming.org/times/time-standards 에서
     "Motivational Standards (Age Group)" PDF를 내려받는다.
  2. python3 tools/build_levels.py <pdf경로> [retrieved날짜 YYYY-MM-DD]

의존성: pypdf (pip install pypdf)

PDF 표 구조 (2024-2028 기준):
  - 페이지마다 "10 & under Girls Event 10 & under Boys" 형태의 연령대 헤더
  - 각 행: Girls 6개 기록(B→AAAA, 느린→빠른) | "거리 영법 코스" | Boys 6개 기록(AAAA→B, 빠른→느린)
새 quad의 PDF에서 레이아웃이 바뀌면 정규식을 조정할 것.
"""
import json
import re
import sys
from datetime import date

from pypdf import PdfReader

AGE_KEY = {"10 & under": "10U", "11-12": "11-12", "13-14": "13-14",
           "15-16": "15-16", "17-18": "17-18"}
GIRL_ORDER = ["B", "BB", "A", "AA", "AAA", "AAAA"]
BOY_ORDER = ["AAAA", "AAA", "AA", "A", "BB", "B"]

TIME = r"((?:\d+:)?\d{1,2}\.\d{2})"
SEP = r"\s*\*?\s*"
LINE_RE = re.compile(SEP.join([TIME] * 6) + r"\s*\*?\s*(\d+)\s+(FR|BK|BR|FL|IM)\s+(SCY|SCM|LCM)\s+" + SEP.join([TIME] * 6))
AGE_RE = re.compile(r"(10 & under|11-12|13-14|15-16|17-18) Girls Event")


def to_sec(s):
    if ":" in s:
        m, sec = s.split(":")
        return round(int(m) * 60 + float(sec), 2)
    return float(s)


def parse(pdf_path):
    reader = PdfReader(pdf_path)
    text = "\n".join(p.extract_text() for p in reader.pages)
    data, cur_age = {}, None
    for raw in text.splitlines():
        m = AGE_RE.search(raw)
        if m:
            cur_age = AGE_KEY[m.group(1)]
            continue
        m = LINE_RE.search(raw)
        if m and cur_age:
            g = m.groups()
            girls = [to_sec(x) for x in g[0:6]]
            dist, stroke, course = g[6], g[7], g[8]
            boys = [to_sec(x) for x in g[9:15]]
            node = data.setdefault(cur_age, {}).setdefault(course, {}).setdefault(f"{dist} {stroke}", {})
            node["F"] = dict(zip(GIRL_ORDER, girls))
            node["M"] = dict(zip(BOY_ORDER, boys))
    return data


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    pdf_path = sys.argv[1]
    retrieved = sys.argv[2] if len(sys.argv) > 2 else date.today().isoformat()
    data = parse(pdf_path)
    assert data, "PDF에서 기준을 하나도 파싱하지 못함 — 레이아웃 변경 여부 확인 필요"

    out = {
        "source": {
            "name": "USA Swimming 2024-2028 Motivational Time Standards (Age Group)",
            "url": "https://www.usaswimming.org/times/time-standards",
            "document": pdf_path.rsplit("/", 1)[-1],
            "retrieved": retrieved,
            "note": "공식 PDF에서 추출한 원본 값. 초 단위(float). 기록이 기준값 이하(빠름)이면 해당 등급 달성.",
        },
        "levelOrder": ["B", "BB", "A", "AA", "AAA", "AAAA"],
        "levelLabels": {
            "PRE_B": {"name": "B 도달 전", "ko": "기초를 다지는 단계", "hint": "B 기준까지의 여정이 시작점"},
            "B": {"name": "B", "ko": "대회 입문", "hint": "공식 대회 경험을 쌓는 단계"},
            "BB": {"name": "BB", "ko": "성장 가속", "hint": "레이스 기술이 붙기 시작하는 단계"},
            "A": {"name": "A", "ko": "경쟁 진입", "hint": "지역(LSC) 챔피언십급 대회 경쟁 수준"},
            "AA": {"name": "AA", "ko": "상위 경쟁", "hint": "지역 상위권, 주 단위 대회 파이널 수준"},
            "AAA": {"name": "AAA", "ko": "전국 지향", "hint": "전국 단위 무대를 바라보는 수준"},
            "AAAA": {"name": "AAAA", "ko": "최상위", "hint": "연령대 최상위, 챔피언십 트랙 진입"},
            "AAAA_PLUS": {"name": "AAAA+", "ko": "챔피언십 트랙", "hint": "Sectionals 이상 커트 도전 수준"},
        },
        "championshipLadder": {
            "note": "AAAA 위의 단계. 대회별·연도별로 커트 타임이 다르므로 공식 페이지에서 확인.",
            "url": "https://www.usaswimming.org/times/time-standards",
            "steps": ["Sectionals", "Futures", "Junior Nationals", "Nationals", "Olympic Trials"],
        },
        "ageGroups": [
            {"key": "10U", "label": "10세 이하", "min": 0, "max": 10},
            {"key": "11-12", "label": "11-12세", "min": 11, "max": 12},
            {"key": "13-14", "label": "13-14세", "min": 13, "max": 14},
            {"key": "15-16", "label": "15-16세", "min": 15, "max": 16},
            {"key": "17-18", "label": "17-18세", "min": 17, "max": 18},
        ],
        "courses": {"SCY": "Short Course Yards (25yd)", "SCM": "Short Course Meters (25m)",
                    "LCM": "Long Course Meters (50m)"},
        "strokeLabels": {"FR": "자유형", "BK": "배영", "BR": "평영", "FL": "접영", "IM": "개인혼영"},
        "standards": data,
    }
    with open("docs/data/levels.json", "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    n = sum(len(evs) for a in data.values() for evs in a.values())
    print(f"docs/data/levels.json 생성 완료: 연령대 {len(data)}개, 연령대×코스×종목 {n}행")


if __name__ == "__main__":
    main()
