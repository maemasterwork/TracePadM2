"""Tests for the content pipeline: the verifier must pass on good output and fail on every kind of loss."""
import copy, json, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LESSON = ROOT / "content/lessons/01-objects-and-data-structures"
sys.path.insert(0, str(Path(__file__).parent))
import extract  # noqa: E402


def run_verify(lesson_dir, doc):
    with tempfile.TemporaryDirectory() as t:
        p = Path(t) / "x.json"
        p.write_text(json.dumps(doc), encoding="utf-8")
        r = subprocess.run([sys.executable, "-I", "-X", "utf8", str(Path(__file__).parent / "verify.py"), str(lesson_dir), str(p)],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        return r.returncode, r.stdout


def good():
    text = (LESSON / "lesson.md").read_text(encoding="utf-8")
    doc = extract.extract(text, LESSON.name)
    extract.assign_code_ids(doc)
    return doc


class Pipeline(unittest.TestCase):
    def test_good(self):
        rc, out = run_verify(LESSON, good())
        self.assertEqual(rc, 0, out)
        self.assertIn("0 lines lost", out)

    def test_dropped_block_detected(self):
        d = good()
        del d["chapters"][2]["sections"][1]["blocks"][0]
        rc, out = run_verify(LESSON, d)
        self.assertEqual(rc, 1)
        self.assertIn("not in any block", out)

    def test_altered_text_detected(self):
        d = good()
        b = d["chapters"][0]["sections"][1]["blocks"][0]
        b["raw"] = b["raw"] + " extra"
        rc, out = run_verify(LESSON, d)
        self.assertEqual(rc, 1)

    def test_dropped_chapter_detected(self):
        d = good()
        d["chapters"].pop(4)
        rc, _ = run_verify(LESSON, d)
        self.assertEqual(rc, 1)

    def test_edited_source_detected(self):
        d = good()
        with tempfile.TemporaryDirectory() as t:
            (Path(t) / "lesson.md").write_text((LESSON / "lesson.md").read_text(encoding="utf-8") + "\nNew line\n", encoding="utf-8")
            rc, out = run_verify(Path(t), d)
        self.assertEqual(rc, 1)
        self.assertIn("sha256", out)

    def test_nested_code_is_runnable_part(self):
        d = good()
        ids = [p["id"] for s in d["chapters"][1]["sections"] if s["id"] == "2.9"
               for b in s["blocks"] if b["type"] == "list"
               for it in b["items"] for p in it["parts"] if p["type"] == "code"]
        self.assertEqual(ids, ["2.9#1"])

    def test_headings_inside_code_are_not_headings(self):
        d = good()
        titles = [s["title"] for c in d["chapters"] for s in c["sections"]]
        self.assertNotIn("2nd_place = \"Ali\"    # SyntaxError: starts with digit", titles)
        self.assertEqual(len(d["chapters"]), 11)



class ChapterNumbers(unittest.TestCase):
    """Progress keys carry only a chapter number, so the numbers the app sees must never repeat across lessons."""

    def test_base(self):
        import build
        self.assertEqual(build.chapter_base(1), 0)      # lesson 1 keeps 1..99 (existing learner data)
        self.assertEqual(build.chapter_base(2), 200)
        self.assertEqual(build.chapter_base(10), 1000)

    def test_unique_across_every_published_lesson(self):
        import build, yaml
        course = yaml.safe_load((ROOT / "content/course.yml").read_text(encoding="utf-8"))
        seen, ids = {}, {}
        for les in course["lessons"]:
            if les["status"] != "published":
                continue
            d = ROOT / "content/lessons" / les["id"]
            doc = extract.extract((d / "lesson.md").read_text(encoding="utf-8"), d.name)
            nums = {c["n"] for c in doc["chapters"]}
            for c in doc["chapters"]:
                g = c["n"] + build.chapter_base(les["number"])
                self.assertNotIn(g, seen, f"{les['id']} chapter {c['n']} collides with {seen.get(g)}")
                self.assertNotIn(c["id"], ids, f"chapter id {c['id']} is used by two lessons")
                seen[g], ids[c["id"]] = les["id"], les["id"]
            labs = yaml.safe_load((d / "labs.yml").read_text(encoding="utf-8")) or {}
            for k in (labs.get("chapters") or {}):
                self.assertIn(int(k), nums, f"{les['id']} labs.yml has chapter {k} but the lesson does not")


if __name__ == "__main__":
    unittest.main()
