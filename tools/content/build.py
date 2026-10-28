#!/usr/bin/env python3
"""Content build: for every published lesson in content/course.yml run extract -> verify -> labs check, then write the
files the web app loads from apps/web/public/content/. Any failure stops the build with a non-zero exit.

Usage: python3 -I tools/content/build.py            (run from the repository root)
Then:  node tools/content/engine_check.mjs content/build/*.items.json   (differential test in the browser engine)
"""
import json
import subprocess
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).parent))
import flowchart  # noqa: E402
import mermaid_chart  # noqa: E402
from verify import iter_blocks  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).parent
BUILD = ROOT / "content" / "build"
PUBLIC = ROOT / "apps" / "web" / "public" / "content"


def chapter_base(number: int) -> int:
    """Progress keys carry only a chapter number (read:<n>, pred:<n>:<id>, note:<n>:<line>, SQL class_progress), so the
    chapter numbers the app sees must be unique across lessons. Lesson 1 keeps 1..99 (existing learner data stays valid);
    lesson N >= 2 uses N*100 + the chapter number printed in the lesson (lesson 2 chapter 3 is 203); lesson 0 uses 10000 + it. The app shows the
    printed number again with chapterNo() in src/content/chapterNo.ts."""
    if number == 0:
        return 10000  # lesson 0 (the flowchart primer) sits above every numbered lesson: 10001, 10002, ...
    return 0 if number == 1 else number * 100


def sh(*args) -> None:
    r = subprocess.run([sys.executable, "-I", "-X", "utf8", *map(str, args)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    sys.stdout.write(r.stdout)
    if r.returncode != 0:
        sys.stderr.write(r.stderr)
        sys.exit(r.returncode)


def main() -> int:
    for stream in (sys.stdout, sys.stderr):  # Windows consoles default to a legacy code page; lesson text has Persian and symbols
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    course = yaml.safe_load((ROOT / "content" / "course.yml").read_text(encoding="utf-8"))
    BUILD.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    manifest = {"course": course["course"], "lessons": []}
    concepts: dict[str, dict] = {}
    seen_chapter_ids: dict[str, str] = {}
    names = yaml.safe_load((ROOT / "content" / "concepts.yml").read_text(encoding="utf-8")) or {}
    for les in course["lessons"]:
        entry = {k: les[k] for k in ("id", "number", "status", "title", "kind", "label") if k in les}
        if les["status"] == "published":
            ldir = ROOT / "content" / "lessons" / les["id"]
            lj = BUILD / f"{les['id'][:2]}.json"
            sh(HERE / "extract.py", ldir, lj)
            sh(HERE / "verify.py", ldir, lj)
            sh(HERE / "check_labs.py", ldir, lj, BUILD)
            doc = json.loads(lj.read_text(encoding="utf-8"))
            labs = yaml.safe_load((ldir / "labs.yml").read_text(encoding="utf-8"))
            base = chapter_base(les["number"])
            for c in doc["chapters"]:
                if c["id"] in seen_chapter_ids:
                    sys.exit(f"chapter id {c['id']!r} is used by both {seen_chapter_ids[c['id']]} and {les['id']}; chapter ids (the heading slugs) must be unique across lessons because assignments refer to them")
                seen_chapter_ids[c["id"]] = les["id"]
                c["n"] += base
            labs["chapters"] = {str(int(k) + base): v for k, v in (labs.get("chapters") or {}).items()}
            out = PUBLIC / les["id"]
            out.mkdir(parents=True, exist_ok=True)
            blocks_meta = (yaml.safe_load((ldir / "blocks.yml").read_text(encoding="utf-8")) or {}).get("blocks", {}) if (ldir / "blocks.yml").exists() else {}
            doc["block_meta"] = blocks_meta
            (out / "lesson.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            (out / "labs.json").write_text(json.dumps(labs, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            # flowcharts: one per runnable example (lesson code blocks and prediction programs), generated from the code itself
            flows, skipped = {}, []
            def chart(key, code):
                r = flowchart.build(code)
                if "error" in r:
                    sys.exit(f"flowchart for {key} is malformed: " + "; ".join(r["error"]))
                if "skip" in r:
                    skipped.append((key, r["skip"]))
                else:
                    flows[key] = {"charts": r["charts"], "control": r["control"]}
            def mermaid(key, code):
                r = mermaid_chart.build(code)
                if "error" in r:
                    sys.exit(f"mermaid diagram {key} is malformed: " + "; ".join(r["error"]))
                if "skip" in r:
                    skipped.append((key, r["skip"]))
                else:
                    flows[key] = {"charts": r["charts"], "control": r["control"]}
            for b in iter_blocks(doc):
                if b.get("type") == "code" and b.get("lang") in ("python", "py", None, ""):
                    chart(f"block:{b['id']}", b["code"])
                elif b.get("type") == "code" and b.get("lang") == "mermaid":
                    mermaid(f"block:{b['id']}", b["code"])  # the lesson's own diagram, laid out here and drawn by the app
            for chno, ch in labs["chapters"].items():
                for p in ch.get("predictions", []):
                    chart(f"pred:{chno}:{p['id']}", p["code"])
            (out / "flow.json").write_text(json.dumps(flows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            ctrl = sum(1 for v in flows.values() if v["control"])
            print(f"flowcharts {les['id']}: {len(flows)} drawn ({ctrl} with branches or loops, {len(flows) - ctrl} straight-line), {len(skipped)} without a chart")
            for k, why in skipped:
                print(f"  no chart for {k}: {why}")
            for chno, ch in labs["chapters"].items():
                for kind in ("predictions", "quizzes"):
                    for it in ch.get(kind, []):
                        concepts.setdefault(it["tag"], {"tag": it["tag"], "lessons": set(), "chapters": set(), "items": 0})
                        concepts[it["tag"]]["lessons"].add(les["id"])
                        concepts[it["tag"]]["items"] += 1
                        concepts[it["tag"]]["chapters"].add(f"{les['id']}#{int(chno) - base}")
            entry["chapters"] = [{"n": c["n"], "id": c["id"], "title": c["title"]} for c in doc["chapters"]]
            entry["path"] = f"content/{les['id']}"
        manifest["lessons"].append(entry)
    (PUBLIC / "course.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    missing = sorted(set(concepts) - set(names))
    unused = sorted(set(names) - set(concepts))
    if missing:
        print("CONCEPT NAMES MISSING in content/concepts.yml:", ", ".join(missing))
        return 1
    if unused:
        print("note: concept names not used by any item:", ", ".join(unused))
    for tag, nm in names.items():
        if not isinstance(nm, dict) or not nm.get("en"):
            print(f"concepts.yml: {tag} needs an en name (fa is optional until Persian is started)")
            return 1
    cl = sorted(({**v, "lessons": sorted(v["lessons"]), "chapters": sorted(v["chapters"]), "name": names[v["tag"]]} for v in concepts.values()), key=lambda v: v["tag"])
    (PUBLIC / "concepts.json").write_text(json.dumps(cl, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"content build ok: {sum(1 for l in course['lessons'] if l['status']=='published')} published lesson(s), {len(cl)} concept tags -> {PUBLIC}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
