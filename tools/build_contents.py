#!/usr/bin/env python3
"""폴더 구조 → docs/data/contents.json 생성기.

퍼즐 하나 = 폴더 하나라는 규칙을 사이트가 읽는 단일 JSON으로 옮긴다.
정적 사이트(GitHub Pages)는 디렉터리를 나열하지 못하므로, 배포 전에 이 스크립트가
폴더를 스캔해 contents.json을 만들어 준다. 글 파일을 추가/삭제하면 조각 수가 자동 반영된다.

폴더 규칙:
  docs/content/audiences.json                     ← 독자층 정의(트랙·온보딩·단계/관심사)
  docs/content/<audience>/<puzzle>/puzzle.json    ← 퍼즐 메타(제목·질문·활성화조건·사진 출처)
  docs/content/<audience>/<puzzle>/cover.jpg      ← 대표 이미지 (성별 변형: cover_M.jpg / cover_F.jpg)
  docs/content/<audience>/<puzzle>/NN-<slug>.md   ← 글. 앞의 두 자리 번호가 조각 순서

글(md) 규칙:
  상단 YAML frontmatter(--- ... ---)에 조각의 태그·노출 조건을 둔다.
  제목은 본문 첫 번째 `# 제목`(H1)에서 그대로 가져온다(제목의 단일 출처).

  ---
  id: swimmer-when-to-start        # 콘텐츠 고유 id(<트랙>-<슬러그>). 상호 링크 매칭 기준
  tag: PRE_B                       # 카드에 표시되는 짧은 태그
  pieces: 3                        # 글 내부 소단락(조각) 개수 표시용
  levels: [PRE_B, B]               # (swimmer) 이 등급에서 우선 노출
  ages: [10U, 11-12]               # (swimmer) 연령대
  sex: all                         # (swimmer) all | M | F
  related: [parent-kids-sports-start]   # 교차 추천 대상 콘텐츠 id
  ---
"""
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "docs")
CONTENT_DIR = os.path.join(ROOT, "content")
OUT = os.path.join(ROOT, "data", "contents.json")

FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", re.S)
H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.M)
NUM_MD_RE = re.compile(r"^(\d+)-(.+)\.md$")


def parse_yaml(text):
    """의존성 없이 쓰기 위한 최소 YAML 파서 (frontmatter 전용).
    지원: key: scalar / key: [a, b, c] / 따옴표 문자열. PyYAML이 있으면 그것을 쓴다."""
    try:
        import yaml
        return yaml.safe_load(text) or {}
    except Exception:
        pass
    out = {}
    for line in text.splitlines():
        line = line.rstrip()
        if not line or line.lstrip().startswith("#") or ":" not in line:
            continue
        key, _, val = line.partition(":")
        key = key.strip()
        val = val.strip()
        if val.startswith("[") and val.endswith("]"):
            items = [x.strip().strip("'\"") for x in val[1:-1].split(",")]
            out[key] = [x for x in items if x]
        elif val:
            out[key] = val.strip("'\"")
        else:
            out[key] = None
    return out


def read_md(path):
    raw = open(path, encoding="utf-8").read()
    m = FM_RE.match(raw)
    if m:
        meta = parse_yaml(m.group(1))
        body = m.group(2)
    else:
        meta, body = {}, raw
    h1 = H1_RE.search(body)
    title = h1.group(1).strip() if h1 else meta.get("title", "(제목 없음)")
    return meta, title


def cover_base_for(audience, puzzle, folder):
    """폴더 안의 cover 파일을 찾아 docs 기준 상대 경로 베이스와 성별변형 여부를 돌려준다."""
    files = set(os.listdir(folder))
    rel = f"content/{audience}/{puzzle}/cover"
    sexed = "cover_M.jpg" in files or "cover_F.jpg" in files
    return rel, sexed


def build():
    audiences = json.load(open(os.path.join(CONTENT_DIR, "audiences.json"), encoding="utf-8"))
    series, contents, errors = [], [], []
    seen_ids = {}

    aud_order = [a["key"] for a in audiences]
    for audience in aud_order:
        aud_dir = os.path.join(CONTENT_DIR, audience)
        if not os.path.isdir(aud_dir):
            continue
        puzzles = [d for d in os.listdir(aud_dir)
                   if os.path.isdir(os.path.join(aud_dir, d))]
        entries = []
        for pid in puzzles:
            folder = os.path.join(aud_dir, pid)
            pjson = os.path.join(folder, "puzzle.json")
            if not os.path.exists(pjson):
                errors.append(f"{audience}/{pid}: puzzle.json 없음")
                continue
            meta = json.load(open(pjson, encoding="utf-8"))
            md_files = sorted(f for f in os.listdir(folder) if NUM_MD_RE.match(f))
            if not md_files:
                errors.append(f"{audience}/{pid}: 번호가 붙은 글(md)이 없음")
                continue
            article_ids = []
            for fn in md_files:
                fmeta, title = read_md(os.path.join(folder, fn))
                cid = fmeta.get("id")
                if not cid:
                    errors.append(f"{audience}/{pid}/{fn}: frontmatter에 id 없음")
                    continue
                if cid in seen_ids:
                    errors.append(f"id 중복: {cid} ({seen_ids[cid]} ↔ {audience}/{pid}/{fn})")
                    continue
                seen_ids[cid] = f"{audience}/{pid}/{fn}"
                article_ids.append(cid)
                c = {
                    "id": cid,
                    "audience": audience,
                    "tag": fmeta.get("tag", ""),
                    "title": title,
                    "file": f"content/{audience}/{pid}/{fn}",
                    "pieces": int(fmeta.get("pieces", 3)),
                }
                if fmeta.get("levels"):
                    c["levels"] = fmeta["levels"]
                if fmeta.get("ages"):
                    c["ages"] = fmeta["ages"]
                if fmeta.get("sex"):
                    c["sex"] = fmeta["sex"]
                if fmeta.get("related"):
                    c["related"] = fmeta["related"]
                contents.append(c)
            cover_base, sexed = cover_base_for(audience, pid, folder)
            entries.append({
                "_order": meta.get("order", 999),
                "id": pid,
                "audience": audience,
                "emoji": meta.get("emoji", "🧩"),
                "title": meta.get("title", pid),
                "question": meta.get("question", ""),
                "unlock": meta.get("unlock", {}),
                "unlockLabel": meta.get("unlockLabel", ""),
                "coverBase": cover_base,
                "sexed": sexed,
                "credit": meta.get("credit", {}),
                "articles": article_ids,
            })
        entries.sort(key=lambda e: e["_order"])
        for e in entries:
            e.pop("_order", None)
            series.append(e)

    db = {"audiences": audiences, "series": series, "contents": contents}
    if errors:
        print("BUILD ERRORS:")
        for e in errors:
            print("  -", e)
        return None
    return db


if __name__ == "__main__":
    db = build()
    if db is None:
        sys.exit(1)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"OK — audiences: {len(db['audiences'])} | series: {len(db['series'])} | contents: {len(db['contents'])}")
    print(f"→ {os.path.relpath(OUT)}")
