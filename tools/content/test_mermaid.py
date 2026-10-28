"""Tests for the Mermaid-subset flowchart layout (tools/content/mermaid_chart.py)."""
import json, subprocess, sys, unittest
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import extract  # noqa: E402
import flowchart as F  # noqa: E402
import mermaid_chart as M  # noqa: E402
from verify import iter_blocks  # noqa: E402

WHILE = """flowchart TD
    A([Start]) --> B[i = 1]
    B --> C{i <= 5?}
    C -->|Yes| D[/Print i/]
    D --> E[i = i + 1]
    E --> C
    C -->|No| F([End])
"""


def chart(src):
    r = M.build(src)
    assert "charts" in r, r
    return r["charts"][0]


def node(c, text):
    return next(n for n in c["nodes"] if text in " ".join(n["text"]))


class Mermaid(unittest.TestCase):
    def test_sequence_is_one_column(self):
        c = chart("flowchart TD\n A([Start]) --> B[/Read a/]\n B --> C[total = a + b]\n C --> D([End])\n")
        self.assertEqual(len({n["x"] for n in c["nodes"]}), 1)
        self.assertEqual([n["kind"] for n in c["nodes"]], ["start", "io", "process", "end"])
        self.assertEqual(F.validate(c), [])

    def test_decision_exits_are_labelled_and_the_first_continues_straight_down(self):
        c = chart(WHILE)
        q = node(c, "i <= 5")
        self.assertEqual(q["kind"], "decision")
        self.assertEqual(node(c, "Print i")["x"], q["x"])          # Yes continues below the question
        self.assertGreater(node(c, "End")["x"], q["x"])             # No goes out to the right
        labels = sorted(e["label"] for e in c["edges"] if e.get("label"))
        self.assertEqual(labels, ["No", "Yes"])

    def test_a_loop_is_a_back_edge_drawn_on_the_left(self):
        c = chart(WHILE)
        backs = [e for e in c["edges"] if e.get("back")]
        self.assertEqual(len(backs), 1)
        self.assertLess(min(p[0] for p in backs[0]["pts"]), min(n["x"] - n["w"] / 2 for n in c["nodes"]))
        self.assertEqual((backs[0]["from"], backs[0]["to"]), ("E", "C"))

    def test_branches_that_join_meet_on_one_box(self):
        c = chart("flowchart TD\n A([Start]) --> B{n % 2 == 0?}\n B -->|Yes| C[/Print Even/]\n B -->|No| D[/Print Odd/]\n C --> E([End])\n D --> E\n")
        into_end = [e for e in c["edges"] if e["to"] == "E"]
        self.assertEqual(len(into_end), 2)
        self.assertEqual({tuple(e["pts"][-1]) for e in into_end}, {tuple(into_end[0]["pts"][-1])})  # same arrival point

    def test_long_edges_do_not_cross_boxes(self):
        src = ("flowchart TD\n A([Start]) --> H{Won?}\n H -->|No| J{Full?}\n H -->|Yes| I[/Winner/]\n"
               " J -->|No| L[Switch]\n J -->|Yes| K[/Tie/]\n L --> A\n I --> M([End])\n K --> M\n")
        r = M.build(src)
        self.assertIn("charts", r, r)
        chart = r["charts"][0]
        boxes = {n["id"]: n for n in chart["nodes"]}
        for e in chart["edges"]:
            pts = e["pts"]
            for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
                for k, n in boxes.items():
                    if k in (e["from"], e["to"]):
                        continue
                    left, right, top, bottom = n["x"] - n["w"] / 2 + 2, n["x"] + n["w"] / 2 - 2, n["y"] + 2, n["y"] + n["h"] - 2
                    hit = max(min(x1, x2), left) <= min(max(x1, x2), right) and max(min(y1, y2), top) <= min(max(y1, y2), bottom)
                    self.assertFalse(hit, f"edge {e['from']}->{e['to']} runs through box {k}")

    def test_every_diagram_in_every_published_lesson_is_drawn_and_valid(self):
        import yaml
        course = yaml.safe_load((ROOT / "content/course.yml").read_text(encoding="utf-8"))
        n = 0
        for les in course["lessons"]:
            if les["status"] != "published":
                continue
            d = ROOT / "content/lessons" / les["id"]
            doc = extract.extract((d / "lesson.md").read_text(encoding="utf-8"), d.name)
            extract.assign_code_ids(doc)
            for b in iter_blocks(doc):
                if b["type"] == "code" and b["lang"] == "mermaid":
                    r = M.build(b["code"])
                    self.assertIn("charts", r, f"{les['id']} {b['id']}: {r}")
                    self.assertEqual(F.validate(r["charts"][0]), [])
                    n += 1
        self.assertGreaterEqual(n, 10)


if __name__ == "__main__":
    unittest.main()
