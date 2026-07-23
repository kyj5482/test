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
  status: published                # (선택) 글의 생애주기 상태. 기본값 published. 아래 표 참조
  publish: 2026-08-15              # (planned 권장) 게시 예정일. 프론트가 '○월 ○일 공개'로 표시
  prompt: |                        # (선택) 이 글을 만든/만들 나의 프롬프트. 사이트엔 노출 안 됨
    여기에 원천 프롬프트를 적는다. 여러 줄 가능.
  ---

  contents.json으로 방출되는 값: status·publish는 실린다(프론트에서 사용). prompt는 절대 방출
  안 한다(원천 프롬프트 비공개). app.js도 frontmatter를 통째로 떼고 렌더하므로 프롬프트는
  화면·DOM 어디에도 남지 않는다.

  status(글의 생애주기, 생략하면 published):
    ┌───────────┬────────────────┬──────────────────────────────────────────────┐
    │ 값        │ 사이트         │ 의미                                           │
    ├───────────┼────────────────┼──────────────────────────────────────────────┤
    │ published │ 노출·클릭 가능 │ 본문 완성·게시됨(기본값)                       │
    │ planned   │ 노출·클릭 차단 │ 프롬프트만 있고 본문 미작성. publish 날짜를     │
    │           │                │ '게시 예정'으로 보여주고 조각은 열리지 않는다. │
    │ revise    │ 노출·클릭 가능 │ 게시됐지만 프롬프트 수정됨 → 본문 재생성 대상  │
    └───────────┴────────────────┴──────────────────────────────────────────────┘
    세 상태 모두 contents.json에 실린다. planned도 이제 '게시 예정'으로 노출된다(숨기지 않음).
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
    지원: key: scalar / key: [a, b, c] / 따옴표 문자열 / key: | 블록 스칼라.
    PyYAML이 있으면 그것을 쓴다(배포 CI에는 없을 수 있어 아래 폴백이 실제로 돈다).

    블록 스칼라(| )는 여러 줄 `prompt:`를 담기 위한 것으로, 들여쓰기된 후속 줄을
    한 값으로 모은다 — 그래야 프롬프트 본문이 id/tag 같은 다른 키를 덮어쓰지 않는다."""
    try:
        import yaml
        return yaml.safe_load(text) or {}
    except Exception:
        pass
    out = {}
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        i += 1
        stripped = line.strip()
        # 최상위(들여쓰기 없음) 키만 해석. 들여쓰인 줄은 블록 스칼라가 이미 소비한다.
        if not stripped or stripped.startswith("#") or line[:1] in (" ", "\t") or ":" not in line:
            continue
        key, _, val = line.partition(":")
        key = key.strip()
        val = val.strip()
        if val in ("|", "|-", ">", ">-"):  # 블록 스칼라: 들여쓰인 후속 줄을 모은다
            block = []
            while i < len(lines) and (lines[i].strip() == "" or lines[i][:1] in (" ", "\t")):
                block.append(lines[i])
                i += 1
            dedented = "\n".join(b.strip() for b in block).strip()
            out[key] = dedented or None
        elif val.startswith("[") and val.endswith("]"):
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


def load_products(all_content_ids, all_series_ids, errors):
    """docs/content/products.json → 제품(브랜드) 목록.

    각 제품은 GitHub에서 개발 중인 앱 하나를 서비스로 소개한다. feature의 stories와
    제품의 series는 퍼즐 글/시리즈 id를 가리키며 — '이 기능은 이 이야기에서 태어났다'는
    스토리→기능 연결의 원천이다. 존재하지 않는 id를 가리키면 빌드 오류."""
    path = os.path.join(CONTENT_DIR, "products.json")
    if not os.path.exists(path):
        return []
    products = json.load(open(path, encoding="utf-8"))
    for p in products:
        for sid in p.get("series", []):
            if sid not in all_series_ids:
                errors.append(f"products.json/{p['key']}: 없는 시리즈 id '{sid}'")
        for f in p.get("features", []):
            for cid in f.get("stories", []):
                if cid not in all_content_ids:
                    errors.append(f"products.json/{p['key']}/{f['name']}: 없는 글 id '{cid}'")
    return products


def load_newsletters(all_content_ids, product_keys, errors):
    """docs/content/newsletters/*.md → 뉴스레터 목록.

    md 파일을 추가해 두면 그중 status: published인 것만 사이트에 발행된다(선택적 발행).
    draft는 산출물에 싣지 않는다 — 앱 출시/버전 업그레이드에 맞춰 published로 바꿔 발행."""
    nl_dir = os.path.join(CONTENT_DIR, "newsletters")
    if not os.path.isdir(nl_dir):
        return []
    out = []
    for fn in sorted(os.listdir(nl_dir), reverse=True):
        if not fn.endswith(".md"):
            continue
        meta, title = read_md(os.path.join(nl_dir, fn))
        status = (str(meta.get("status") or "draft")).strip()
        if status not in ("published", "draft"):
            errors.append(f"newsletters/{fn}: 알 수 없는 status '{status}' (published|draft)")
            continue
        if status != "published":
            continue
        nid = meta.get("id")
        if not nid:
            errors.append(f"newsletters/{fn}: frontmatter에 id 없음")
            continue
        stories = meta.get("stories") or []
        for cid in stories:
            if cid not in all_content_ids:
                errors.append(f"newsletters/{fn}: 없는 글 id '{cid}'")
        product = meta.get("product")
        if product and product not in product_keys:
            errors.append(f"newsletters/{fn}: 없는 제품 key '{product}'")
        out.append({
            "id": nid,
            "title": title,
            "date": str(meta.get("date") or ""),
            "product": product,
            "version": meta.get("version"),
            "stories": stories,
            "file": f"content/newsletters/{fn}",
        })
    out.sort(key=lambda n: n["date"], reverse=True)
    return out


def cover_base_for(audience, puzzle, folder):
    """폴더 안의 cover 파일을 찾아 docs 기준 상대 경로 베이스와 성별변형 여부를 돌려준다."""
    files = set(os.listdir(folder))
    rel = f"content/{audience}/{puzzle}/cover"
    sexed = "cover_M.jpg" in files or "cover_F.jpg" in files
    return rel, sexed


def build():
    audiences = json.load(open(os.path.join(CONTENT_DIR, "audiences.json"), encoding="utf-8"))
    series, contents, errors = [], [], []
    revise_pending = []
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
                status = (str(fmeta.get("status") or "published")).strip()
                if status not in ("published", "planned", "revise"):
                    errors.append(f"{audience}/{pid}/{fn}: 알 수 없는 status '{status}'"
                                  f" (published|planned|revise)")
                    continue
                # planned = 프롬프트만 있고 미작성. 사이트에는 '게시 예정'으로 노출하되
                # (날짜 표시 + 클릭 차단) 본문은 열지 않는다. revise = 게시됐지만 프롬프트
                # 수정됨 → 재작성 대상. 세 상태 모두 contents.json에 실린다.
                if status == "revise":
                    revise_pending.append(f"{audience}/{pid}/{fn}")
                publish = fmeta.get("publish")
                if status == "planned" and not publish:
                    print(f"  · 게시일 미정: {audience}/{pid}/{fn} (planned인데 publish 날짜 없음)")
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
                    "status": status,  # published | planned | revise (prompt는 절대 방출 안 함)
                }
                if publish:
                    c["publish"] = str(publish)
                if fmeta.get("levels"):
                    c["levels"] = fmeta["levels"]
                if fmeta.get("ages"):
                    c["ages"] = fmeta["ages"]
                if fmeta.get("sex"):
                    c["sex"] = fmeta["sex"]
                if fmeta.get("related"):
                    c["related"] = fmeta["related"]
                contents.append(c)
            if not article_ids:
                errors.append(f"{audience}/{pid}: 유효한 글이 없음")
                continue
            cover_base, sexed = cover_base_for(audience, pid, folder)
            cover_files = [f for f in os.listdir(folder) if f.startswith("cover")]
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
                "hasCover": bool(cover_files),  # 커버 사진 없으면 프론트가 플레이스홀더 표시
                "credit": meta.get("credit", {}),
                "articles": article_ids,
            })
        entries.sort(key=lambda e: e["_order"])
        for e in entries:
            e.pop("_order", None)
            series.append(e)

    all_content_ids = set(seen_ids)
    all_series_ids = {s["id"] for s in series}
    products = load_products(all_content_ids, all_series_ids, errors)
    newsletters = load_newsletters(all_content_ids, {p["key"] for p in products}, errors)

    db = {"audiences": audiences, "series": series, "contents": contents,
          "products": products, "newsletters": newsletters}
    if errors:
        print("BUILD ERRORS:")
        for e in errors:
            print("  -", e)
        return None
    if revise_pending:
        print(f"  · 재작성 대기(status: revise) {len(revise_pending)}개 — 프롬프트 수정됨, 본문 재생성 필요:")
        for p in revise_pending:
            print("    -", p)
    return db


if __name__ == "__main__":
    db = build()
    if db is None:
        sys.exit(1)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"OK — audiences: {len(db['audiences'])} | series: {len(db['series'])} | contents: {len(db['contents'])}"
          f" | products: {len(db['products'])} | newsletters(발행): {len(db['newsletters'])}")
    print(f"→ {os.path.relpath(OUT)}")
