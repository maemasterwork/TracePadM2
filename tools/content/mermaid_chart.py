#!/usr/bin/env python3
"""Mermaid flowcharts (the small subset used in lessons) -> the same chart JSON the Python flowchart generator writes.

The lesson text keeps its Mermaid source (it is the lesson's own text and is never edited); the browser cannot run
Mermaid (no extra libraries, strict content-security policy), so the build lays the diagram out here and the app draws
it with the same SVG renderer as the generated charts: right-to-left aware, light and dark, a text version for screen
readers.

Supported:  flowchart TD / TB (top down), nodes  id([pill])  id[box]  id[/input or output/]  id{question}  id[["subroutine"]],
            edges  a --> b   and   a -->|label| b   (also chained on one line).
Not supported (the block is skipped with a reason): LR/RL/BT directions, subgraphs, styling, other shapes, other arrows.

Layout: layers by longest path (loops are detected as back edges and drawn around the left side), one column per branch:
the first exit of a node continues straight down, the other exits get new columns to the right. Long edges pass through
free slots, so nothing is drawn over a box. build() validates the result (nothing off the canvas or overlapping).

build(source) -> {"charts": [chart], "control": bool} | {"skip": reason} | {"error": [problems]}
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import flowchart as F  # noqa: E402  (labels wrapping, validate)

CH_W = 7.6          # estimated pixels per character at the chart's font size
GAP_Y = 44          # between layers (room for the sideways part of an arrow and its label)
GAP_X = 44          # between columns
PAD = 24
LANE0, LANE_STEP = 30, 16
MAX_NODES = 24      # a lesson diagram is small; bigger means it is probably not meant to be drawn this way
MAX_WIDTH = 1100

NODE_RE = re.compile(r"""\s*([A-Za-z_]\w*)(?:\(\[(.+?)\]\)|\[\[(.+?)\]\]|\[/(.+?)/\]|\{(.+?)\}|\[(.+?)\])?""")
EDGE_RE = re.compile(r"\s*-->\s*(?:\|([^|]*)\|\s*)?")


class Unsupported(Exception):
    pass


def _clean(t: str) -> str:
    t = t.strip()
    if len(t) >= 2 and t[0] == '"' and t[-1] == '"':
        t = t[1:-1]
    t = re.sub(r"<br\s*/?>", " ", t, flags=re.I)
    return " ".join(t.split())


def parse(src: str):
    lines = [l for l in src.replace("\r\n", "\n").split("\n") if l.strip() and not l.strip().startswith("%%")]
    if not lines:
        raise Unsupported("empty")
    head = lines[0].split()
    if head[0] not in ("flowchart", "graph"):
        raise Unsupported("not a flowchart")
    if len(head) < 2 or head[1] not in ("TD", "TB"):
        raise Unsupported("only top-down (TD) diagrams are drawn")
    nodes: dict[str, dict] = {}
    edges: list[tuple[str, str, str]] = []

    def node(m) -> str:
        nid = m.group(1)
        shapes = [("pill", m.group(2)), ("define", m.group(3)), ("io", m.group(4)), ("decision", m.group(5)), ("process", m.group(6))]
        shape, text = next(((s, t) for s, t in shapes if t is not None), (None, None))
        if nid not in nodes:
            nodes[nid] = {"id": nid, "shape": shape, "text": _clean(text) if text is not None else None}
        elif shape is not None:
            nodes[nid].update(shape=shape, text=_clean(text))
        return nid

    for ln in lines[1:]:
        if re.match(r"\s*(subgraph|end\b|style|classDef|class\b|linkStyle|click|direction)", ln):
            raise Unsupported("subgraphs and styling are not drawn")
        pos = 0
        m = NODE_RE.match(ln, pos)
        if not m:
            raise Unsupported(f"cannot read the line: {ln.strip()[:40]}")
        prev = node(m)
        pos = m.end()
        while pos < len(ln) and ln[pos:].strip():
            e = EDGE_RE.match(ln, pos)
            if not e:
                raise Unsupported(f"unsupported arrow or syntax: {ln[pos:].strip()[:40]}")
            m = NODE_RE.match(ln, e.end())
            if not m:
                raise Unsupported(f"cannot read the line: {ln.strip()[:40]}")
            cur = node(m)
            edges.append((prev, cur, _clean(e.group(1)) if e.group(1) else ""))
            prev, pos = cur, m.end()
    for n in nodes.values():
        if n["shape"] is None or n["text"] is None:
            raise Unsupported(f"node {n['id']} has no label")
    return nodes, edges


def _size(shape: str, lines: list[str]) -> tuple[float, float]:
    tw = max(len(l) for l in lines) * CH_W
    if shape == "decision":
        return min(280.0, max(170.0, tw * 1.35 + 40)), max(F.DEC_H, 24 + F.LINE * len(lines))
    w = min(230.0, max(120.0, tw + 40))
    return w, max(40.0, 20 + F.LINE * len(lines))


def build(src: str) -> dict:
    try:
        nodes, edges = parse(src)
    except Unsupported as e:
        return {"skip": str(e)}
    if len(nodes) > MAX_NODES:
        return {"skip": f"more than {MAX_NODES} boxes"}
    order = list(nodes)                       # first node defined = where the flow starts
    entry = order[0]
    out_edges: dict[str, list[int]] = {k: [] for k in nodes}
    for i, (a, b, _) in enumerate(edges):
        if a == b:
            return {"skip": "a box pointing at itself is not drawn"}
        out_edges[a].append(i)

    # -- loops: depth-first from the start; an edge to a box still being explored is a back edge
    state: dict[str, int] = {}
    back: set[int] = set()
    disc: list[str] = []
    finish: list[str] = []

    def dfs(u):
        state[u] = 1
        disc.append(u)
        for i in out_edges[u]:
            v = edges[i][1]
            if state.get(v) == 1:
                back.add(i)
            elif v not in state:
                dfs(v)
        state[u] = 2
        finish.append(u)

    dfs(entry)
    unreached = [k for k in nodes if k not in state]
    if unreached:
        return {"error": [f"not reachable from the first box: {nodes[k]['text']}" for k in unreached]}
    fwd = [i for i in range(len(edges)) if i not in back]
    parents: dict[str, list[int]] = {k: [] for k in nodes}
    children: dict[str, list[int]] = {k: [] for k in nodes}
    for i in fwd:
        a, b, _ = edges[i]
        parents[b].append(i)
        children[a].append(i)

    # -- layers: longest path from the start over forward edges
    layer: dict[str, int] = {}
    for u in reversed(finish):
        layer[u] = max([layer[edges[i][0]] + 1 for i in parents[u]], default=0)
    didx = {k: i for i, k in enumerate(disc)}
    by_layer: dict[int, list[str]] = {}
    for k in sorted(nodes, key=lambda k: (layer[k], didx[k])):
        by_layer.setdefault(layer[k], []).append(k)

    # -- columns: a box's first exit continues straight down, the others open new columns on the right;
    #    a box where branches join sits in the leftmost column of its parents
    col: dict[str, int] = {}
    taken: set[tuple[int, int]] = set()
    next_col = 1
    for L in sorted(by_layer):
        for k in by_layer[L]:
            ps = [edges[i][0] for i in parents[k]]
            if not ps:
                c = 0
            elif len(ps) == 1:
                p = ps[0]
                kids = [edges[i][1] for i in children[p]]
                if kids.index(k) == 0:
                    c = col[p]
                else:
                    c, next_col = next_col, next_col + 1
            else:
                c = min(col[p] for p in ps)
            while (L, c) in taken:
                c += 1
                next_col = max(next_col, c + 1)
            col[k] = c
            taken.add((L, c))

    # -- boxes
    shape_kind = {"pill": None, "define": "define", "io": "io", "decision": "decision", "process": "process"}
    incoming = {b for _, b, _ in edges}
    info: dict[str, dict] = {}
    for k, n in nodes.items():
        wrap = 18 if n["shape"] == "decision" else 24
        lines = F._wrap(n["text"], wrap)
        kind = shape_kind[n["shape"]] or ("start" if k not in incoming else "end")
        w, h = _size(n["shape"], lines)
        info[k] = {"kind": kind, "lines": lines, "w": w, "h": h, "layer": layer[k], "col": col[k]}

    # -- long edges pass through free slots in the layers between
    slots: dict[int, list[int]] = {}      # edge index -> columns of the intermediate layers
    for i in fwd:
        a, b, _ = edges[i]
        la, lb = layer[a], layer[b]
        cols, cur = [], col[a]
        for L in range(la + 1, lb):
            cands = [cur, col[b]] + [cur + d for d in (1, -1, 2, -2, 3, -3)]
            c = next(c for c in cands if (L, c) not in taken)
            taken.add((L, c))
            cols.append(c)
            cur = c
        slots[i] = cols

    # -- coordinates
    all_cols = sorted({c for (_, c) in taken})
    cw = {c: max([info[k]["w"] for k in nodes if col[k] == c] + [30.0]) for c in all_cols}
    cx: dict[int, float] = {}
    x = 0.0
    for c in all_cols:
        cx[c] = x + cw[c] / 2
        x += cw[c] + GAP_X
    lay_h = {L: max(info[k]["h"] for k in by_layer[L]) for L in by_layer}
    top: dict[int, float] = {}
    y = 0.0
    for L in sorted(by_layer):
        top[L] = y
        y += lay_h[L] + GAP_Y
    total_h = y - GAP_Y
    for k, d in info.items():
        d["x"] = cx[d["col"]]
        d["y"] = top[d["layer"]] + (lay_h[d["layer"]] - d["h"]) / 2

    def band_mid(L: int) -> float:         # the free strip under layer L
        return top[L] + lay_h[L] + GAP_Y / 2

    def left_edge(k):                      # where an arrow meets the side of a box (a parallelogram is slanted)
        d = info[k]
        return d["x"] - d["w"] / 2 + (7 if d["kind"] == "io" else 0)

    def right_edge(k):
        d = info[k]
        return d["x"] + d["w"] / 2 - (7 if d["kind"] == "io" else 0)

    min_left = min(info[k]["x"] - info[k]["w"] / 2 for k in nodes)
    max_right = max(info[k]["x"] + info[k]["w"] / 2 for k in nodes)
    lanes = {"L": 0, "R": 0}
    out: list[dict] = []

    def simplify(pts):
        res = []
        for p in pts:
            if res and abs(res[-1][0] - p[0]) < 0.01 and abs(res[-1][1] - p[1]) < 0.01:
                continue
            res.append(p)
        i = 1
        while i < len(res) - 1:
            a, b, c = res[i - 1], res[i], res[i + 1]
            if (abs(a[0] - b[0]) < 0.01 and abs(b[0] - c[0]) < 0.01) or (abs(a[1] - b[1]) < 0.01 and abs(b[1] - c[1]) < 0.01):
                del res[i]
            else:
                i += 1
        return res

    for i, (a, b, label) in enumerate(edges):
        A, B = info[a], info[b]
        if i in back:
            leftmost = lambda k: all(col[o] >= col[k] for o in nodes if layer[o] == layer[k])
            rightmost = lambda k: all(col[o] <= col[k] for o in nodes if layer[o] == layer[k])
            side = "L" if leftmost(b) or not rightmost(b) else "R"
            lane = lanes[side]
            lanes[side] += 1
            xl = (min_left - LANE0 - LANE_STEP * lane) if side == "L" else (max_right + LANE0 + LANE_STEP * lane)
            edge_x = left_edge if side == "L" else right_edge
            free = all((col[o] >= col[a]) if side == "L" else (col[o] <= col[a]) for o in nodes if layer[o] == layer[a])
            tgt = (edge_x(b), B["y"] + B["h"] / 2)
            if free:
                pts = [(edge_x(a), A["y"] + A["h"] / 2), (xl, A["y"] + A["h"] / 2), (xl, tgt[1]), tgt]
            else:
                ym = band_mid(A["layer"])
                pts = [(A["x"], A["y"] + A["h"]), (A["x"], ym), (xl, ym), (xl, tgt[1]), tgt]
            out.append({"pts": simplify(pts), "from": a, "to": b, "label": label, "back": True})
            continue
        la, lb = A["layer"], B["layer"]
        wps = [(la + 1 + j, cx[c]) for j, c in enumerate(slots[i])] + [(lb, B["x"])]
        x1 = wps[0][1]
        decision_exit = A["kind"] == "decision" and len(children[a]) >= 2
        if decision_exit and x1 < A["x"] - 1:
            start = (A["x"] - A["w"] / 2, A["y"] + A["h"] / 2)
            tip = True
        elif decision_exit and x1 > A["x"] + 1:
            start = (A["x"] + A["w"] / 2, A["y"] + A["h"] / 2)
            tip = True
        else:
            start = (A["x"], A["y"] + A["h"])
            tip = False
        pts = [start]
        xcur, prev_layer = start[0], la
        for j, (Lj, xj) in enumerate(wps):
            if tip and j == 0:
                pts.append((xj, start[1]))
            elif abs(xj - xcur) > 0.01:
                ym = band_mid(prev_layer)
                pts += [(xcur, ym), (xj, ym)]
            xcur, prev_layer = xj, Lj
        pts.append((B["x"], B["y"]))
        out.append({"pts": simplify(pts), "from": a, "to": b, "label": label})

    # -- canvas
    xs = [info[k]["x"] - info[k]["w"] / 2 for k in nodes] + [info[k]["x"] + info[k]["w"] / 2 for k in nodes]
    for e in out:
        xs += [p[0] for p in e["pts"]]
    minx, maxx = min(xs), max(xs)
    dx, dy = PAD - minx, PAD
    width = maxx - minx + 2 * PAD
    if width > MAX_WIDTH:
        return {"skip": f"too wide (more than {MAX_WIDTH} px)"}
    chart_nodes = [{"id": k, "kind": d["kind"], "text": d["lines"], "x": round(d["x"] + dx, 1), "y": round(d["y"] + dy, 1),
                    "w": round(d["w"], 1), "h": round(d["h"], 1)} for k, d in info.items()]
    chart_edges = []
    for e in out:
        ed = {"pts": [[round(x + dx, 1), round(y + dy, 1)] for x, y in e["pts"]], "from": e["from"], "to": e["to"]}
        if e["label"]:
            ed["label"] = e["label"]
        if e.get("back"):
            ed["back"] = True
        chart_edges.append(ed)
    chart = {"title": "Flowchart", "w": round(width, 1), "h": round(total_h + 2 * PAD, 1), "nodes": chart_nodes,
             "edges": chart_edges, "outline": _outline(nodes, info, edges, back, entry, disc)}
    problems = F.validate(chart)
    if problems:
        return {"error": problems}
    control = any(len(children[k]) >= 2 for k in nodes) or bool(back)
    return {"charts": [chart], "control": control}


def _label(info_k) -> str:
    return " ".join(info_k["lines"])


def _outline(nodes, info, edges, back, entry, disc):
    """Text version: every box once, in reading order, with where each arrow goes."""
    outs: dict[str, list[int]] = {k: [] for k in nodes}
    for i, (a, _, _) in enumerate(edges):
        outs[a].append(i)
    items = []
    for k in disc:
        d = info[k]
        prefix = {"decision": "Question: ", "io": "Input or output: ", "define": "Run another flowchart: "}.get(d["kind"], "")
        text = f"{prefix}{nodes[k]['text']}"
        kids = []
        for i in outs[k]:
            _, b, lab = edges[i]
            goes = "back to" if i in back else "go to"
            kids.append({"text": (f"If {lab}: " if lab else "Then: ") + f"{goes} “{nodes[b]['text']}”"})
        item = {"text": text}
        if kids:
            item["children"] = kids
        items.append(item)
    return items


if __name__ == "__main__":  # python3 mermaid_chart.py file.mmd -> JSON on stdout
    json.dump(build(open(sys.argv[1], encoding="utf-8").read()), sys.stdout, indent=1)
