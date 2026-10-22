"""Tests for the flowchart generator: structure, geometry, honesty (nothing silently dropped), limits."""
import sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import flowchart as F  # noqa: E402


def chart(code, i=0):
    r = F.build(code)
    assert "charts" in r, r
    return r["charts"][i]


def kinds(c):
    return [n["kind"] for n in c["nodes"]]


def texts(c):
    return [" ".join(n["text"]) for n in c["nodes"]]


class Structure(unittest.TestCase):
    def test_straight_line_is_a_chain(self):
        c = chart("x = 1\nprint(x)\n")
        self.assertEqual(kinds(c), ["start", "process", "io", "end"])
        self.assertEqual(len(c["edges"]), 3)
        self.assertEqual(texts(c)[1], "Set x to 1")
        self.assertEqual(texts(c)[2], "Show x")

    def test_if_else_has_two_branches_and_a_join(self):
        c = chart("if x > 1:\n    a = 1\nelse:\n    a = 2\nprint(a)\n")
        self.assertEqual(kinds(c).count("decision"), 1)
        self.assertEqual(kinds(c).count("merge"), 1)
        labels = sorted(e["label"] for e in c["edges"] if e.get("label"))
        self.assertEqual(labels, ["no", "yes"])

    def test_if_without_else_still_has_a_no_edge(self):
        c = chart("if x:\n    print(1)\n")
        self.assertIn("no", [e.get("label") for e in c["edges"]])

    def test_elif_chain_nests_decisions(self):
        c = chart("if a:\n    pass\nelif b:\n    pass\nelse:\n    pass\n")
        self.assertEqual(kinds(c).count("decision"), 2)

    def test_loop_has_back_edge_and_exit(self):
        c = chart("for i in range(3):\n    print(i)\nprint('x')\n")
        self.assertTrue(any(e.get("back") for e in c["edges"]))
        self.assertIn("done", [e.get("label") for e in c["edges"]])
        self.assertEqual(kinds(c).count("loop"), 1)

    def test_while_break_continue(self):
        c = chart("while True:\n    if a:\n        break\n    if b:\n        continue\n    c()\n")
        self.assertIn("break", kinds(c))
        self.assertIn("continue", kinds(c))
        self.assertIn("break", [e.get("label") for e in c["edges"]])

    def test_loop_else_is_not_dropped(self):
        c = chart("for i in x:\n    if i:\n        break\nelse:\n    print('none')\n")
        self.assertTrue(any("none" in t for t in texts(c)))

    def test_function_gets_its_own_chart(self):
        r = F.build("def f(a, b):\n    return a + b\nprint(f(1, 2))\n")
        self.assertEqual(len(r["charts"]), 2)
        self.assertTrue(r["charts"][1]["title"].startswith("Inside f(a, b)"))
        self.assertIn("define", kinds(r["charts"][0]))
        self.assertIn("return", kinds(r["charts"][1]))
        # a return is connected back to the end of the function's chart
        c = r["charts"][1]
        end = next(n["id"] for n in c["nodes"] if n["kind"] == "end")
        self.assertTrue(any(e["to"] == end for e in c["edges"]))

    def test_try_except_finally(self):
        c = chart("try:\n    x = int(s)\nexcept ValueError:\n    x = 0\nfinally:\n    print('done')\n")
        self.assertIn("error", kinds(c))
        self.assertTrue(any(e.get("dashed") for e in c["edges"]))
        self.assertTrue(any("done" in t for t in texts(c)))

    def test_raise_and_return_end_the_path(self):
        c = chart("def f(x):\n    if x:\n        raise ValueError('no')\n    return 1\n", 1)
        self.assertIn("error", kinds(c))
        self.assertIn("return", kinds(c))

    def test_every_node_is_reached_by_an_edge(self):
        for code in ["for i in x:\n    if i:\n        print(i)\n    else:\n        continue\n",
                     "while a:\n    try:\n        b()\n    except E:\n        break\n",
                     "if a:\n    for i in b:\n        c()\nelse:\n    d()\n"]:
            c = chart(code)
            targets = {e["to"] for e in c["edges"]}
            for n in c["nodes"]:
                if n["kind"] != "start":
                    self.assertIn(n["id"], targets, (n["text"], code))


class Geometry(unittest.TestCase):
    def test_nothing_outside_the_canvas_and_no_overlaps(self):
        code = "for i in range(3):\n    if i % 2:\n        print('odd')\n    else:\n        print('even')\nprint('end')\n"
        c = chart(code)
        for n in c["nodes"]:
            self.assertGreaterEqual(n["x"] - n["w"] / 2, -0.5)
            self.assertLessEqual(n["x"] + n["w"] / 2, c["w"] + 0.5)
            self.assertGreaterEqual(n["y"], 0)
            self.assertLessEqual(n["y"] + n["h"], c["h"] + 0.5)
        ns = [n for n in c["nodes"] if n["kind"] != "merge"]
        for i, a in enumerate(ns):
            for b in ns[i + 1:]:
                sep = (a["x"] + a["w"] / 2 <= b["x"] - b["w"] / 2 + 0.5 or b["x"] + b["w"] / 2 <= a["x"] - a["w"] / 2 + 0.5
                       or a["y"] + a["h"] <= b["y"] + 0.5 or b["y"] + b["h"] <= a["y"] + 0.5)
                self.assertTrue(sep, f"{a['text']} overlaps {b['text']}")

    def test_edge_points_lie_on_the_canvas(self):
        c = chart("while a:\n    if b:\n        break\n    c()\n")
        for e in c["edges"]:
            for x, y in e["pts"]:
                self.assertTrue(-0.5 <= x <= c["w"] + 0.5 and -0.5 <= y <= c["h"] + 0.5, e)

    def test_deterministic(self):
        code = "for i in range(3):\n    print(i)\n"
        self.assertEqual(F.build(code), F.build(code))


class Validator(unittest.TestCase):
    def test_validator_catches_overlap_and_orphans(self):
        c = chart("x = 1\nprint(x)\n")
        self.assertEqual(F.validate(c), [])
        broken = {**c, "nodes": [dict(n) for n in c["nodes"]]}
        broken["nodes"][2]["y"] = broken["nodes"][1]["y"]          # on top of the previous box
        self.assertTrue(any("overlap" in p for p in F.validate(broken)))
        orphan = {**c, "edges": c["edges"][:-1]}                   # the last arrow is missing
        self.assertTrue(any("nothing points to" in p for p in F.validate(orphan)))
        off = {**c, "w": 50}
        self.assertTrue(any("outside" in p for p in F.validate(off)))

    def test_every_chart_of_the_lesson_is_valid(self):
        import json
        f = Path(__file__).resolve().parents[2] / "apps/web/public/content/01-objects-and-data-structures/flow.json"
        if not f.exists():
            self.skipTest("run the content build first")
        for key, v in json.loads(f.read_text(encoding="utf-8")).items():
            for c in v["charts"]:
                self.assertEqual(F.validate(c), [], key)


class Honesty(unittest.TestCase):
    def test_source_lines_are_recorded(self):
        c = chart("x = 1\nif x:\n    print(x)\n")
        by = {" ".join(n["text"]): n.get("lines") for n in c["nodes"]}
        self.assertEqual(by["Set x to 1"], [1, 1])
        self.assertEqual(by["x ?"], [2, 2])
        self.assertEqual(by["Show x"], [3, 3])

    def test_not_a_program_gets_no_chart_and_says_why(self):
        r = F.build("this is ( not python")
        self.assertIn("skip", r)
        self.assertIn("parse", r["skip"])

    def test_too_big_gets_no_chart_and_says_why(self):
        r = F.build("\n".join(f"if a{i}:\n    b{i}()" for i in range(60)))
        self.assertIn("skip", r)

    def test_long_straight_code_is_grouped_but_keeps_every_line(self):
        code = "\n".join(f"print({i})" for i in range(20))
        c = chart(code)
        self.assertEqual(kinds(c).count("group"), 4)
        covered = sum(n["lines"][1] - n["lines"][0] + 1 for n in c["nodes"] if n.get("lines"))
        self.assertEqual(covered, 20)

    def test_outline_mentions_every_branch(self):
        c = chart("if a:\n    x()\nelse:\n    y()\n")
        flat = []
        def walk(items):
            for it in items:
                flat.append(it["text"])
                walk(it.get("children", []))
        walk(c["outline"])
        joined = " | ".join(flat)
        self.assertIn("If yes:", joined)
        self.assertIn("If no:", joined)


if __name__ == "__main__":
    unittest.main()
