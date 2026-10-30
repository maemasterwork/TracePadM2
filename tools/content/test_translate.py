"""Tests for merging a translated lesson onto the English one (tools/content/translate.py)."""
import sys, unittest
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import extract  # noqa: E402
import translate  # noqa: E402

EN = """# Title

Intro.

## 1. First

Hello **world**.

| A | B |
|---|---|
| 1 | 2 |

- one
- two

```python
print("hi")
```

```mermaid
flowchart TD
    A([Start]) --> B{x > 1?}
    B -->|Yes| C[/Print big/]
    B -->|No| D([End])
    C --> D
```

- [x] done
- [ ] todo
"""

FA = EN.replace("# Title", "# عنوان").replace("Intro.", "مقدمه.").replace("## 1. First", "## ۱. اول") \
    .replace("Hello **world**.", "سلام **دنیا**.").replace("| A | B |", "| الف | ب |").replace("- one", "- یک").replace("- two", "- دو") \
    .replace("Start", "شروع").replace("Yes", "بله").replace("No", "خیر").replace("Print big", "چاپ بزرگ").replace("End", "پایان") \
    .replace("done", "انجام شد").replace("todo", "باید")


def doc(text):
    d = extract.extract(text, "t")
    extract.assign_code_ids(d)
    return d


def merge(fa):
    return translate.merge(doc(EN), doc(fa), 0)


class Merge(unittest.TestCase):
    def test_same_structure_merges_cleanly(self):
        m, errors = merge(FA)
        self.assertEqual(errors, [])
        self.assertEqual(m["lang"], "fa")
        self.assertEqual(m["chapters"][0]["title"], doc(FA)["chapters"][0]["title"])
        self.assertEqual(m["chapters"][0]["n"], 1)  # the English skeleton keeps its numbers

    def test_missing_block(self):
        _, errors = merge(FA.replace("Hello **world**.\n", "").replace("سلام **دنیا**.\n", ""))
        self.assertTrue(any("block(s)" in e for e in errors), errors)

    def test_changed_code(self):
        _, errors = merge(FA.replace('print("hi")', 'print("سلام")'))
        self.assertTrue(any("code must stay identical" in e for e in errors), errors)

    def test_table_columns(self):
        _, errors = merge(FA.replace("| الف | ب |\n|---|---|\n| 1 | 2 |", "| الف |\n|---|\n| 1 |"))
        self.assertTrue(any("table" in e for e in errors), errors)

    def test_list_items(self):
        _, errors = merge(FA.replace("- دو\n", ""))
        self.assertTrue(any("list must keep 2" in e for e in errors), errors)

    def test_checklist_ticks(self):
        _, errors = merge(FA.replace("- [x] انجام شد", "- [ ] انجام شد"))
        self.assertTrue(any("checklist" in e for e in errors), errors)

    def test_diagram_arrows(self):
        _, errors = merge(FA.replace("    C --> D\n", ""))
        self.assertTrue(any("Mermaid" in e for e in errors), errors)

    def test_diagram_labels_may_change(self):
        m, errors = merge(FA)
        self.assertEqual(errors, [])
        codes = [c for _, c in translate.mermaid_blocks(m)]
        self.assertIn("شروع", codes[0])


if __name__ == "__main__":
    unittest.main()
