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
        src = ("flowchart TD\n A([Start]) --> B{x >= 90?}\n B -->|Yes| C[/Print A/]\n B -->|No| D{x >= 80?}\n D -->|Yes| E[/Print B/]\n"
               " D -->|No| G[/Print F/]\n C --> J([End])\n E --> J\n G --> J\n")
        c = chart(src)
        boxes = c["nodes"]
        for e in c["edges"]:
            for (x1, y1), (x2, y2) in zip(e["pts"], e["pts"][1:]):
                for n in boxes:
                    if n["id"] in (e["from"], e["to"]):
                        continue
                    inside_x = n["x"] - n["w"] / 2 < min(x1, x2) + 0.1 and max(x1, x2) - 0.1 < n["x"] + n["w"] / 2 or (min(x1, x2) < n["x"] + n["w"] / 2 and max(x1, x2) > n["x"] - n["w"] / 2)
                    inside_y = min(y1, y2) < n["y"] + n["h"] and max(y1, y2) > n["y"]
                    self.assertFalse(inside_x and inside_y, f"edge {e['from']}->{e['to']} crosses {n['text']}")

    def test_subroutine_shape(self):
        c = chart('flowchart TD\n A([Start]) --> B[["Call add_tax(price)"]]\n B --> C([End])\n')
        self.assertEqual(node(c, "add_tax")["kind"], "define")

    def test_text_version_names_every_box_and_where_arrows_go(self):
        c = chart(WHILE)
        text = json.dumps(c["outline"])
        for s in ("Question: i <= 5?", "If Yes:", "If No:", "back to"):
            self.assertIn(s, text)

    def test_what_cannot_be_drawn_is_skipped_with_a_reason(self):
        self.assertIn("skip", M.build("flowchart LR\n A --> B\n"))
        self.assertIn("skip", M.build("flowchart TD\n subgraph x\n A --> B\n end\n"))
        self.assertIn("skip", M.build("flowchart TD\n A --> B\n A -.-> B\n"))
        self.assertIn("skip", M.build("sequenceDiagram\n A->>B: hi\n"))

    def test_a_box_nothing_reaches_is_an_error_not_a_wrong_picture(self):
        r = M.build("flowchart TD\n A[x] --> B[y]\n C[z] --> B\n")
        self.assertIn("error", r)

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
        self.assertGreaterEqual(n, 9)


if __name__ == "__main__":
    unittest.main()
