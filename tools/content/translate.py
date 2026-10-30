#!/usr/bin/env python3
"""Merge a translated lesson (lesson.fa.md) onto the English lesson, block by block.

The English lesson stays the skeleton: its chapter numbers and ids, section ids, code block ids, and the source line
numbers that notes, bookmarks and search links use. Only the words change. That is only safe when the translation has
exactly the same structure, so this module first checks that (and reports every difference with its place), then
copies the translated text into a copy of the English document.

Rules a translation must follow (each is checked):
  * the same chapters, sections (same levels) and blocks, in the same order and of the same kinds;
  * every code block is identical to the English one (the examples, their flowcharts and the practice items refer to
    that exact code); Mermaid diagrams keep the same boxes, shapes and arrows but may translate the labels;
  * tables keep their rows and columns, lists keep their items, checklists keep their ticks;
  * headings may be translated; the chapter slug in links (#3-strings) stays the English one, because it is the URL.

Usage (from build.py): merge(en_doc, fa_doc, base) -> (merged_doc, errors); base is the chapter offset build.py added to en_doc
"""
from __future__ import annotations

import copy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mermaid_chart  # noqa: E402


def _diagram_shape(code: str):
    nodes, edges = mermaid_chart.parse(code)
    return ([(k, n["shape"]) for k, n in nodes.items()], [(a, b, bool(lbl)) for a, b, lbl in edges])


def _code_parts(block):
    """Code of a code block, or the code parts of a list, in order: [(lang, code)]."""
    if block["type"] == "code":
        return [(block.get("lang", ""), block["code"])]
    if block["type"] == "list":
        return [(p.get("lang", ""), p["code"]) for it in block["items"] for p in it["parts"] if p["type"] == "code"]
    return []


def _same_code(where: str, en_parts, fa_parts, errors):
    if len(en_parts) != len(fa_parts):
        errors.append(f"{where}: {len(fa_parts)} code block(s) here, the English lesson has {len(en_parts)}")
        return
    for i, ((le, ce), (lf, cf)) in enumerate(zip(en_parts, fa_parts), 1):
        if le != lf:
            errors.append(f"{where}: code block {i} is ```{lf} but the English one is ```{le}")
        elif le == "mermaid":
            try:
                if _diagram_shape(ce) != _diagram_shape(cf):
                    errors.append(f"{where}: Mermaid diagram {i} must keep the same boxes, shapes and arrows (only labels may change)")
            except mermaid_chart.Unsupported as e:  # an undrawable diagram: it must at least be identical in structure line by line
                if [l.split('[')[0].split('(')[0].split('{')[0] for l in ce.splitlines()] != [l.split('[')[0].split('(')[0].split('{')[0] for l in cf.splitlines()]:
                    errors.append(f"{where}: Mermaid diagram {i} ({e}) has a different structure")
        elif ce != cf:
            first = next((n for n, (x, y) in enumerate(zip(ce.splitlines(), cf.splitlines()), 1) if x != y), min(len(ce.splitlines()), len(cf.splitlines())) + 1)
            errors.append(f"{where}: code block {i} differs from the English one at its line {first}; code must stay identical")


def _merge_blocks(where: str, en_blocks, fa_blocks, errors):
    if len(en_blocks) != len(fa_blocks):
        errors.append(f"{where}: {len(fa_blocks)} block(s), the English lesson has {len(en_blocks)} "
                      f"(a paragraph, list, table, quote, code block or rule is missing or extra)")
        return [copy.deepcopy(b) for b in en_blocks]
    out = []
    for i, (e, f) in enumerate(zip(en_blocks, fa_blocks), 1):
        here = f"{where}, block {i} (English line {e['start']}, translated line {f['start']})"
        m = copy.deepcopy(e)
        if e["type"] != f["type"]:
            errors.append(f"{here}: is a {f['type']} but the English one is a {e['type']}")
            out.append(m)
            continue
        t = e["type"]
        if t in ("paragraph", "quote"):
            m["raw"] = f["raw"]
        elif t == "table":
            if len(e["rows"]) != len(f["rows"]) or len(e["header"]) != len(f["header"]) or e["align"] != f["align"]:
                errors.append(f"{here}: the table must keep {len(e['header'])} columns, {len(e['rows'])} rows and its alignment")
            else:
                m["raw"], m["header"], m["rows"] = f["raw"], f["header"], f["rows"]
        elif t == "list":
            if e["ordered"] != f["ordered"] or len(e["items"]) != len(f["items"]):
                errors.append(f"{here}: the list must keep {len(e['items'])} {'numbered' if e['ordered'] else 'bulleted'} items")
            else:
                _same_code(here, _code_parts(e), _code_parts(f), errors)
                bad = False
                for ie, if_ in zip(e["items"], f["items"]):
                    if [p["type"] for p in ie["parts"]] != [p["type"] for p in if_["parts"]]:
                        errors.append(f"{here}: a list item has a different mix of text and code than the English one")
                        bad = True
                        break
                if not bad:
                    m["raw"] = f["raw"]
                    for im, if_ in zip(m["items"], f["items"]):
                        for pm, pf in zip(im["parts"], if_["parts"]):
                            if pm["type"] == "text":
                                pm["md"] = pf["md"]
                            elif pm.get("lang") == "mermaid":
                                pm["code"] = pf["code"]
        elif t == "checklist":
            if [x["checked"] for x in e["items"]] != [x["checked"] for x in f["items"]]:
                errors.append(f"{here}: the checklist must keep {len(e['items'])} items with the same ticks")
            else:
                m["raw"] = f["raw"]
                for im, if_ in zip(m["items"], f["items"]):
                    im["text"] = if_["text"]
        elif t == "code":
            _same_code(here, _code_parts(e), _code_parts(f), errors)
            if e.get("lang") == "mermaid":
                m["code"], m["raw"] = f["code"], f["raw"]  # same boxes, translated labels
        # hr: nothing to translate
        out.append(m)
    return out


def merge(en: dict, fa: dict, base: int = 0):
    errors: list[str] = []
    merged = copy.deepcopy(en)
    merged["lang"] = "fa"
    merged["title"] = fa["title"]

    # preamble (the text before chapter 1)
    pe, pf = en["preamble"], fa["preamble"]
    merged["preamble"]["blocks"] = _merge_blocks("the introduction", pe["blocks"], pf["blocks"], errors)
    _merge_sections("the introduction", merged["preamble"]["sections"], pe["sections"], pf["sections"], errors)

    if len(en["chapters"]) != len(fa["chapters"]):
        errors.append(f"{len(fa['chapters'])} chapters, the English lesson has {len(en['chapters'])}")
        return merged, errors
    for ce, cf, cm in zip(en["chapters"], fa["chapters"], merged["chapters"]):
        printed = ce["n"] - base
        where = f"chapter {printed} ({ce['title']})"
        if cf["n"] != printed:
            errors.append(f"{where}: numbered {cf['n']} in the translation")
        cm["title"], cm["heading"] = cf["title"], cf["heading"]
        cm["blocks"] = _merge_blocks(where, ce["blocks"], cf["blocks"], errors)
        _merge_sections(where, cm["sections"], ce["sections"], cf["sections"], errors)
    return merged, errors


def _merge_sections(where: str, merged_sections, en_sections, fa_sections, errors):
    if len(en_sections) != len(fa_sections):
        errors.append(f"{where}: {len(fa_sections)} section heading(s), the English lesson has {len(en_sections)}")
        return
    for sm, se, sf in zip(merged_sections, en_sections, fa_sections):
        here = f"{where}, section {se['id']} ({se['heading']})"
        if se["level"] != sf["level"]:
            errors.append(f"{here}: heading level {sf['level']} in the translation, {se['level']} in English")
        sm["title"], sm["heading"] = sf["title"], sf["heading"]
        sm["blocks"] = _merge_blocks(here, se["blocks"], sf["blocks"], errors)


def mermaid_blocks(doc):
    """Every Mermaid block of a (merged) document: (block id, code)."""
    def parts(b):
        if b["type"] == "code":
            yield b
        elif b["type"] == "list":
            for it in b["items"]:
                for p in it["parts"]:
                    if p["type"] == "code":
                        yield p

    def walk(blocks):
        for b in blocks:
            for p in parts(b):
                if p.get("lang") == "mermaid":
                    yield p["id"], p["code"]

    yield from walk(doc["preamble"]["blocks"])
    for s in doc["preamble"]["sections"]:
        yield from walk(s["blocks"])
    for c in doc["chapters"]:
        yield from walk(c["blocks"])
        for s in c["sections"]:
            yield from walk(s["blocks"])
