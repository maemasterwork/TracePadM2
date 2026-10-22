#!/usr/bin/env python3
"""Flowcharts from Python source.

build(code) -> {"charts": [...], "outline": [...], "stats": {...}} or {"skip": "<reason>"}

Python is a structured language, so the layout is structured too (no general graph layout): statements stack
top to bottom, an `if` splits into two columns that join again, a loop has a body with a back edge on the left
and an exit on the right. Everything is computed here, at build time, in plain coordinates; the browser only draws
them (and mirrors x for right-to-left). Nothing is guessed: every node carries the source lines it comes from, so the
tracer can highlight the node that is running.

Plain-language labels are English only for now (Persian is deliberately not provided yet).
"""
from __future__ import annotations

import ast
import json
import sys
from dataclasses import dataclass, field

W = 220            # width of an ordinary box
DEC_W, DEC_H = 240, 72
GAP = 34           # vertical gap between nodes
COL_GAP = 40       # horizontal gap between branches
LINE = 17          # text line height
WRAP = 27          # characters per label line
MAX_NODES = 45     # per chart; a bigger example gets no chart (and says why)
MAX_WIDTH = 1100
GROUP_AFTER = 14   # plain straight-line code longer than this is grouped in chunks
CHUNK = 5

SIMPLE = (ast.Assign, ast.AugAssign, ast.AnnAssign, ast.Expr, ast.Import, ast.ImportFrom, ast.Pass, ast.Delete, ast.Global, ast.Nonlocal, ast.Assert)


class TooBig(Exception):
    pass


def _src(node) -> str:
    try:
        s = ast.unparse(node)
    except Exception:  # pragma: no cover
        s = "?"
    return " ".join(s.split())


def _short(s: str, n: int = 44) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"


def _wrap(text: str, width: int = WRAP) -> list[str]:
    words = text.split(" ")
    lines: list[str] = []
    cur = ""
    for w in words:
        while len(w) > width:  # a long token: hard split
            if cur:
                lines.append(cur)
                cur = ""
            lines.append(w[: width - 1] + "…")
            w = ""
            break
        if not w:
            continue
        if len(cur) + len(w) + (1 if cur else 0) <= width:
            cur = (cur + " " + w) if cur else w
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines[:3] if len(lines) > 3 else (lines or [""])


_OPS = {ast.Add: "Add", ast.Sub: "Subtract", ast.Mult: "Multiply", ast.Div: "Divide", ast.FloorDiv: "Divide (whole part)",
        ast.Mod: "Take the remainder of", ast.Pow: "Raise"}


def _describe(st: ast.stmt) -> tuple[str, str]:
    """(kind, plain-language label) for a simple statement."""
    if isinstance(st, ast.Assign):
        tgt = ", ".join(_src(t) for t in st.targets)
        return "process", f"Set {tgt} to {_short(_src(st.value), 30)}"
    if isinstance(st, ast.AnnAssign):
        return "process", f"Set {_src(st.target)}" + (f" to {_short(_src(st.value), 30)}" if st.value else "")
    if isinstance(st, ast.AugAssign):
        op = type(st.op)
        t, v = _src(st.target), _short(_src(st.value), 24)
        if op is ast.Add:
            return "process", f"Add {v} to {t}"
        if op is ast.Sub:
            return "process", f"Subtract {v} from {t}"
        if op is ast.Mult:
            return "process", f"Multiply {t} by {v}"
        if op is ast.Div:
            return "process", f"Divide {t} by {v}"
        return "process", f"Update {t}: {_short(_src(st), 34)}"
    if isinstance(st, ast.Expr):
        v = st.value
        if isinstance(v, ast.Call) and isinstance(v.func, ast.Name):
            if v.func.id == "print":
                args = ", ".join(_src(a) for a in v.args) or "an empty line"
                return "io", f"Show {_short(args, 34)}"
            if v.func.id == "input":
                return "io", f"Ask: {_short(_src(v.args[0]) if v.args else 'the user', 30)}"
        if isinstance(v, ast.Call) and isinstance(v.func, ast.Attribute):
            return "process", f"Call {_short(_src(v), 34)}"
        if isinstance(v, ast.Call):
            return "process", f"Run {_short(_src(v), 34)}"
        if isinstance(v, ast.Constant) and isinstance(v.value, str):
            return "process", "Note (a text, no effect)"
        return "process", f"Evaluate {_short(_src(v), 32)}"
    if isinstance(st, (ast.Import, ast.ImportFrom)):
        return "process", _short(_src(st).replace("from ", "Import from ", 1).replace("import ", "Import ", 1) if _src(st).startswith("import") else _src(st).replace("from ", "Import from ", 1), 40)
    if isinstance(st, ast.Pass):
        return "process", "Do nothing"
    if isinstance(st, ast.Assert):
        return "process", f"Check that {_short(_src(st.test), 30)}"
    if isinstance(st, ast.Delete):
        return "process", f"Delete {_short(', '.join(_src(t) for t in st.targets), 30)}"
    return "process", _short(_src(st), 40)


def _iter_text(it: ast.expr) -> str:
    """A long literal collection is described, not copied into the box."""
    txt = _src(it)
    if len(txt) <= 24:
        return txt
    names = {ast.List: "list", ast.Tuple: "tuple", ast.Set: "set", ast.Dict: "dictionary"}
    for typ, nm in names.items():
        if isinstance(it, typ):
            n = len(it.keys) if isinstance(it, ast.Dict) else len(it.elts)
            return f"a {nm} of {n} items"
    return _short(txt, 28)


# ---------------------------------------------------------------------------- geometry

@dataclass
class Node:
    id: str
    kind: str                       # start end process io decision loop define merge return error class break continue
    lines: list[str]
    code: str = ""
    src: tuple[int, int] | None = None   # first and last source line (1-based, inside the example)
    x: float = 0                    # centre
    y: float = 0                    # top
    w: float = W
    h: float = 44

    def to_json(self):
        d = {"id": self.id, "kind": self.kind, "text": self.lines, "x": round(self.x, 1), "y": round(self.y, 1), "w": round(self.w, 1), "h": round(self.h, 1)}
        if self.code:
            d["code"] = self.code
        if self.src:
            d["lines"] = list(self.src)
        return d


@dataclass
class Edge:
    pts: list[tuple[float, float]]
    label: str = ""
    dashed: bool = False
    back: bool = False
    src_id: str = ""
    dst_id: str = ""

    def to_json(self):
        d = {"pts": [[round(x, 1), round(y, 1)] for x, y in self.pts], "from": self.src_id, "to": self.dst_id}
        if self.label:
            d["label"] = self.label
        if self.dashed:
            d["dashed"] = True
        if self.back:
            d["back"] = True
        return d


@dataclass
class Exit:
    """A loose end at the bottom of a fragment: polyline from the node's port down to the fragment's bottom edge."""
    node: str
    pts: list[tuple[float, float]]
    label: str = ""
    dashed: bool = False


@dataclass
class Frag:
    nodes: list[Node] = field(default_factory=list)
    edges: list[Edge] = field(default_factory=list)
    entry: str | None = None
    exits: list[Exit] = field(default_factory=list)
    minx: float = 0
    maxx: float = 0
    h: float = 0
    breaks: list[str] = field(default_factory=list)      # ids of break nodes waiting for a loop
    continues: list[str] = field(default_factory=list)
    outline: list = field(default_factory=list)

    def shift(self, dx: float, dy: float):
        for n in self.nodes:
            n.x += dx
            n.y += dy
        for e in self.edges:
            e.pts = [(x + dx, y + dy) for x, y in e.pts]
        for ex in self.exits:
            ex.pts = [(x + dx, y + dy) for x, y in ex.pts]
        self.minx += dx
        self.maxx += dx

    def node(self, i: str) -> Node:
        for n in self.nodes:
            if n.id == i:
                return n
        raise KeyError(i)


class Builder:
    def __init__(self, source_lines: list[str]):
        self.n = 0
        self.src = source_lines
        self.count = 0
        self.extra_charts: list[dict] = []

    def nid(self, p="n") -> str:
        self.n += 1
        return f"{p}{self.n}"

    # -- node factories
    def box(self, kind: str, text: str, src=None, code: str = "") -> Frag:
        self.count += 1
        if self.count > MAX_NODES:
            raise TooBig("more than %d steps" % MAX_NODES)
        lines = _wrap(text)
        if kind in ("decision",):
            w, h = DEC_W, max(DEC_H, 24 + LINE * len(lines))
        elif kind == "loop":
            w, h = DEC_W, max(56, 22 + LINE * len(lines))
        elif kind == "merge":
            w, h = 10, 10
        else:
            w, h = W, max(40, 20 + LINE * len(lines))
        if code and kind == "group":
            h = 20 + LINE * (len(lines) + 0)
        n = Node(self.nid(), kind, lines, code, src, 0, 0, w, h)
        f = Frag([n], [], n.id, [], -w / 2, w / 2, h)
        f.exits = [Exit(n.id, [(0, h)])]
        return f

    # -- composition
    def seq(self, frags: list[Frag]) -> Frag:
        frags = [f for f in frags if f.entry]
        if not frags:
            return Frag()
        out = frags[0]
        for nxt in frags[1:]:
            out = self.join(out, nxt)
        return out

    def join(self, a: Frag, b: Frag) -> Frag:
        """b below a, centred on x=0; every loose end of a is connected to b's entry."""
        b.shift(0, a.h + GAP)
        entry = b.node(b.entry)
        for ex in a.exits:
            mid = a.h + GAP / 2
            x0, y0 = ex.pts[-1]
            pts = list(ex.pts)
            if abs(x0 - entry.x) > 0.5:
                pts += [(x0, mid), (entry.x, mid)]
            pts.append((entry.x, entry.y))
            a.edges.append(Edge(pts, ex.label, ex.dashed, False, ex.node, entry.id))
        a.nodes += b.nodes
        a.edges += b.edges
        a.exits = b.exits
        a.minx, a.maxx = min(a.minx, b.minx), max(a.maxx, b.maxx)
        a.h = a.h + GAP + b.h
        a.breaks += b.breaks
        a.continues += b.continues
        a.outline += b.outline
        return a

    # -- statements
    def block(self, body: list[ast.stmt], ctx: dict) -> Frag:
        frags: list[Frag] = []
        i = 0
        # long runs of simple statements are grouped so a ten-line example does not become a ten-box tower
        simple_total = sum(1 for s in body if isinstance(s, SIMPLE))
        while i < len(body):
            s = body[i]
            if isinstance(s, SIMPLE) and simple_total > GROUP_AFTER:
                j = i
                while j < len(body) and isinstance(body[j], SIMPLE) and j - i < CHUNK:
                    j += 1
                if j - i >= 2:
                    chunk = body[i:j]
                    first, last = chunk[0].lineno, chunk[-1].end_lineno
                    txt = f"Run lines {first}–{last} ({len(chunk)} steps)"
                    f = self.box("group", txt, (first, last), "\n".join(_short(_src(c), 46) for c in chunk))
                    n = f.nodes[0]
                    n.kind = "group"
                    n.h = 20 + LINE * (1 + len(chunk))
                    f.h = n.h
                    f.exits = [Exit(n.id, [(0, n.h)])]
                    f.outline = [{"text": f"Lines {first} to {last}: " + "; ".join(_describe(c)[1] for c in chunk)}]
                    frags.append(f)
                    i = j
                    continue
            frags.append(self.stmt(s, ctx))
            i += 1
        return self.seq(frags)

    def stmt(self, s: ast.stmt, ctx: dict) -> Frag:
        src = (s.lineno, s.end_lineno or s.lineno)
        if isinstance(s, SIMPLE):
            kind, text = _describe(s)
            f = self.box(kind, text, src, _short(_src(s), 70))
            f.outline = [{"text": text}]
            return f
        if isinstance(s, ast.If):
            return self.if_(s, ctx, src)
        if isinstance(s, (ast.For, ast.AsyncFor)):
            return self.loop(s, ctx, src, f"For each {_src(s.target)} in {_iter_text(s.iter)}", "next item", "done")
        if isinstance(s, ast.While):
            return self.loop(s, ctx, src, f"While {_short(_src(s.test), 36)}", "yes", "no")
        if isinstance(s, ast.Return):
            t = f"Return {_short(_src(s.value), 30)}" if s.value else "Return"
            f = self.box("return", t, src, _short(_src(s), 70))
            f.exits = []
            f.outline = [{"text": t + " (the function ends here)"}]
            return f
        if isinstance(s, ast.Break):
            f = self.box("break", "Break: leave the loop", src)
            f.exits = []
            f.breaks = [f.entry]
            f.outline = [{"text": "Break: leave the loop"}]
            return f
        if isinstance(s, ast.Continue):
            f = self.box("continue", "Continue: next round", src)
            f.exits = []
            f.continues = [f.entry]
            f.outline = [{"text": "Continue: go to the next round"}]
            return f
        if isinstance(s, ast.Raise):
            t = f"Raise {_short(_src(s.exc), 28)}" if s.exc else "Raise the error again"
            f = self.box("error", t, src, _short(_src(s), 70))
            f.exits = []
            f.outline = [{"text": t + " (an error stops the program here unless it is caught)"}]
            return f
        if isinstance(s, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return self.define(s, ctx, src)
        if isinstance(s, ast.ClassDef):
            f = self.box("class", f"Define class {s.name}", src, f"class {s.name}")
            f.outline = [{"text": f"Define class {s.name} (its methods are not drawn)"}]
            return f
        if isinstance(s, (ast.With, ast.AsyncWith)):
            ctxt = ", ".join(_short(_src(i.context_expr), 24) + (f" as {_src(i.optional_vars)}" if i.optional_vars else "") for i in s.items)
            head = self.box("process", f"Open {ctxt}", (s.lineno, s.body[0].lineno - 1 if s.body else s.lineno), _short(f"with {ctxt}", 70))
            head.outline = [{"text": f"Open {ctxt}; it closes by itself after the block"}]
            body = self.block(s.body, ctx)
            out = self.seq([head, body])
            out.outline = head.outline + [{"text": "Then:", "children": body.outline}]
            return out
        if isinstance(s, ast.Try):
            return self.try_(s, ctx, src)
        f = self.box("process", _short(_src(s), 40), src, _short(_src(s), 70))
        f.outline = [{"text": f.nodes[0].lines[0]}]
        return f

    def merge(self) -> Frag:
        return self.box("merge", "")

    def if_(self, s: ast.If, ctx, src) -> Frag:
        head = self.box("decision", _short(_src(s.test), 40) + " ?", (s.lineno, s.lineno), _short("if " + _src(s.test), 70))
        hn = head.nodes[0]
        then = self.block(s.body, ctx)
        els = self.block(s.orelse, ctx) if s.orelse else None
        m = self.merge()
        mn = m.nodes[0]
        out = Frag(entry=hn.id)
        out.nodes.append(hn)
        out.minx, out.maxx = hn.x - hn.w / 2, hn.x + hn.w / 2
        outline_then = then.outline
        outline_else = els.outline if els else []
        # breaks / continues travel upwards to the enclosing loop
        out.breaks = then.breaks + (els.breaks if els else [])
        out.continues = then.continues + (els.continues if els else [])
        top = hn.h + GAP
        if els and els.entry:
            span = (then.maxx - els.minx) + COL_GAP
            cl, cr = -span / 2 - 0 + 0, span / 2
            # place so that then's right edge and els's left edge are COL_GAP apart, centred on the decision
            cl = -(then.maxx + COL_GAP / 2) + 0
            cr = -els.minx + COL_GAP / 2
            then.shift(cl, top)
            els.shift(cr, top)
            te, ee = then.node(then.entry), els.node(els.entry)
            out.edges.append(Edge([(-hn.w / 2, hn.h / 2), (te.x, hn.h / 2), (te.x, te.y)], "yes", False, False, hn.id, te.id))
            out.edges.append(Edge([(hn.w / 2, hn.h / 2), (ee.x, hn.h / 2), (ee.x, ee.y)], "no", False, False, hn.id, ee.id))
            h = max(then.h, els.h) + top
            out.nodes += then.nodes + els.nodes
            out.edges += then.edges + els.edges
            out.minx, out.maxx = min(out.minx, then.minx), max(out.maxx, els.maxx)
            loose = then.exits + els.exits
        else:
            then.shift(0, top)
            te = then.node(then.entry) if then.entry else None
            out.nodes += then.nodes
            out.edges += then.edges
            h = then.h + top
            right = max(then.maxx, hn.w / 2) + COL_GAP / 2
            if te:
                out.edges.append(Edge([(0, hn.h), (0, te.y)], "yes", False, False, hn.id, te.id))
            out.minx, out.maxx = min(out.minx, then.minx), max(out.maxx, then.maxx, right)
            loose = list(then.exits)
        # the join point
        mn.y = h + GAP / 2 - mn.h / 2 + GAP / 2 - GAP / 2
        mn.y = h + GAP
        mn.x = 0
        out.nodes.append(mn)
        for ex in loose:
            x0, y0 = ex.pts[-1]
            mid = h + GAP / 2
            pts = list(ex.pts)
            if abs(x0) > 0.5:
                pts += [(x0, mid), (0, mid)]
            pts.append((0, mn.y))
            out.edges.append(Edge(pts, ex.label, ex.dashed, False, ex.node, mn.id))
        if not (els and els.entry):
            right = out.maxx
            out.edges.append(Edge([(hn.w / 2, hn.h / 2), (right, hn.h / 2), (right, mn.y + mn.h / 2), (mn.w / 2, mn.y + mn.h / 2)], "no", False, False, hn.id, mn.id))
        out.h = mn.y + mn.h
        out.exits = [Exit(mn.id, [(0, out.h)])]
        out.outline = [{"text": f"Decision: {_src(s.test)} ?", "children": [{"text": "If yes:", "children": outline_then or [{"text": "nothing"}]}, {"text": "If no:", "children": outline_else or [{"text": "skip to what comes next"}]}]}]
        return out

    def loop(self, s, ctx, src, text, yes, no) -> Frag:
        head = self.box("loop", text, (s.lineno, s.lineno), _short(_src(s).split("\n")[0], 70))
        hn = head.nodes[0]
        body = self.block(s.body, {**ctx, "in_loop": True})
        top = hn.h + GAP
        out = Frag(entry=hn.id)
        out.nodes.append(hn)
        out.minx, out.maxx = -hn.w / 2, hn.w / 2
        body.shift(0, top)
        if body.entry:
            be = body.node(body.entry)
            out.edges.append(Edge([(0, hn.h), (0, be.y)], yes, False, False, hn.id, be.id))
        out.nodes += body.nodes
        out.edges += body.edges
        left = min(body.minx, -hn.w / 2) - COL_GAP / 2
        right = max(body.maxx, hn.w / 2) + 50
        out.minx, out.maxx = min(left, out.minx) - 18, max(right, out.maxx) + 18
        bottom = body.h + top
        # end of the body, and `continue`, go back up the left side
        for ex in body.exits:
            x0, y0 = ex.pts[-1]
            pts = list(ex.pts) + [(x0, bottom + GAP / 2), (left, bottom + GAP / 2), (left, hn.h / 2), (-hn.w / 2, hn.h / 2)]
            out.edges.append(Edge(pts, ex.label, ex.dashed, True, ex.node, hn.id))
        for cid in body.continues:
            n = body.node(cid)
            out.edges.append(Edge([(n.x - n.w / 2, n.y + n.h / 2), (left, n.y + n.h / 2), (left, hn.h / 2), (-hn.w / 2, hn.h / 2)], "", False, True, cid, hn.id))
        # the loop ends: from the head's right side, and from every `break`
        out.h = bottom + GAP / 2
        ends = [Exit(hn.id, [(hn.w / 2, hn.h / 2), (right, hn.h / 2), (right, out.h)], no)]
        for bid in body.breaks:
            n = body.node(bid)
            ends.append(Exit(bid, [(n.x + n.w / 2, n.y + n.h / 2), (right, n.y + n.h / 2), (right, out.h)], "break"))
        out.exits = ends
        out.breaks, out.continues = [], []
        if s.orelse:
            # `else` on a loop runs only when the loop ends normally (not by `break`)
            ef = self.block(s.orelse, ctx)
            if ef.entry:
                brk = [e for e in ends if e.label == "break"]
                done = Exit(hn.id, [(hn.w / 2, hn.h / 2), (right, hn.h / 2), (right, out.h)], no)
                out.exits = [done]
                right2 = max(right, ef.maxx + COL_GAP / 2)
                done.pts = [(hn.w / 2, hn.h / 2), (right2, hn.h / 2), (right2, out.h)]
                out.maxx = max(out.maxx, right2)
                out = self.join(out, ef)
                for e in brk:
                    e.pts = e.pts[:-1] + [(right2, out.h)]
                    e.pts[1:-1] = [(right2, e.pts[0][1])]
                out.exits = ef.exits + brk
                out.maxx = max(out.maxx, right2)
                out.outline = [{"text": text + ":", "children": [{"text": f"Each round ({yes}):", "children": body.outline or [{"text": "nothing"}]},
                                                                  {"text": "When " + no + ", and no 'break' happened: the 'else' part runs", "children": ef.outline},
                                                                  {"text": "If 'break' happened: skip the 'else' part"}]}]
                return out
        inner = body.outline or [{"text": "nothing"}]
        out.outline = [{"text": text + ":", "children": [{"text": f"Each round ({yes}):", "children": inner}, {"text": f"When {no}: go on after the loop"}]}]
        return out

    def try_(self, s: ast.Try, ctx, src) -> Frag:
        head = self.box("process", "Try this part", (s.lineno, s.lineno), "try:")
        hn = head.nodes[0]
        body = self.block(s.body + [], ctx)
        handlers = []
        for h in s.handlers:
            hh = self.box("error", "If " + (_short(_src(h.type), 28) if h.type else "any error") + " happens", (h.lineno, h.lineno), f"except {_src(h.type) if h.type else ''}:")
            hb = self.block(h.body, ctx)
            handlers.append(self.seq([hh, hb]))
        orelse = self.block(s.orelse, ctx) if s.orelse else None
        fin = self.block(s.finalbody, ctx) if s.finalbody else None
        main = self.seq([body, orelse] if orelse and orelse.entry else [body])
        hf = handlers[0] if handlers else None
        for extra in handlers[1:]:
            pass  # a second handler is drawn to the right of the first, see below
        out = Frag(entry=hn.id)
        out.nodes.append(hn)
        top = hn.h + GAP
        cols = [main] + handlers
        x = 0.0
        # lay the columns side by side, left to right, first column centred under the "Try" node
        cursor = 0.0
        placed = []
        for i, c in enumerate(cols):
            if not c.entry:
                continue
            width = c.maxx - c.minx
            cx = cursor - c.minx if i == 0 else cursor - c.minx
            placed.append((c, cx))
            cursor = cx + c.maxx + COL_GAP
        total_left = placed[0][1] + placed[0][0].minx if placed else 0
        total_right = placed[-1][1] + placed[-1][0].maxx if placed else 0
        centre = (total_left + total_right) / 2
        # keep the main column under the "Try" node when there is a single handler: centre the whole group on 0
        loose: list[Exit] = []
        out.minx, out.maxx = -hn.w / 2, hn.w / 2
        for i, (c, cx) in enumerate(placed):
            c.shift(cx - centre, top)
            e = c.node(c.entry)
            out.nodes += c.nodes
            out.edges += c.edges
            out.minx, out.maxx = min(out.minx, c.minx), max(out.maxx, c.maxx)
            if i == 0:
                out.edges.append(Edge([(0, hn.h), (0, hn.h + GAP / 2), (e.x, hn.h + GAP / 2), (e.x, e.y)], "", False, False, hn.id, e.id))
            else:
                out.edges.append(Edge([(hn.w / 2, hn.h / 2), (e.x, hn.h / 2), (e.x, e.y)], "error", True, False, hn.id, e.id))
            loose += c.exits
        h = max((c.h for c, _ in placed), default=0) + top
        m = self.merge()
        mn = m.nodes[0]
        mn.x, mn.y = 0, h + GAP
        out.nodes.append(mn)
        for ex in loose:
            x0, y0 = ex.pts[-1]
            mid = h + GAP / 2
            pts = list(ex.pts)
            if abs(x0) > 0.5:
                pts += [(x0, mid), (0, mid)]
            pts.append((0, mn.y))
            out.edges.append(Edge(pts, ex.label, ex.dashed, False, ex.node, mn.id))
        out.h = mn.y + mn.h
        out.exits = [Exit(mn.id, [(0, out.h)])]
        out.breaks = sum((c.breaks for c, _ in placed), [])
        out.continues = sum((c.continues for c, _ in placed), [])
        out.outline = [{"text": "Try this part; if an error happens, jump to the matching 'except' part", "children": [
            {"text": "Try:", "children": main.outline or [{"text": "nothing"}]}] + [
            {"text": f"If {_src(h.type) if h.type else 'any error'} happens:", "children": hh.outline or [{"text": "nothing"}]} for h, hh in zip(s.handlers, handlers)]}]
        res = out
        if fin and fin.entry:
            fin.outline = [{"text": "Finally (always runs):", "children": fin.outline}]
            res = self.join(res, fin)
            res.outline = out.outline + fin.outline
        return res

    def define(self, s, ctx, src) -> Frag:
        params = ", ".join(a.arg for a in (s.args.posonlyargs + s.args.args)) + (", …" if s.args.vararg or s.args.kwonlyargs or s.args.kwarg else "")
        title = f"{s.name}({params})"
        f = self.box("define", f"Define function {title}", (s.lineno, s.lineno), _short(f"def {title}:", 70))
        f.outline = [{"text": f"Define function {title}. Its steps are drawn in a separate chart: \"Inside {title}\""}]
        # a function body is its own chart; it runs only when the function is called
        sub = Builder(self.src)
        sub.n = 1000 * (len(self.extra_charts) + 2)
        body = sub.block(s.body, {"in_function": True})
        chart = sub.finish(body, f"Inside {title}", start_text=f"{title} is called", end_text="Back to the caller", src=(s.lineno, s.end_lineno or s.lineno))
        self.count += sub.count
        if self.count > MAX_NODES * 2:
            raise TooBig("too many steps")
        self.extra_charts.append(chart)
        self.extra_charts += sub.extra_charts
        return f

    # -- finish a chart: add start and end terminators and normalise coordinates
    def finish(self, body: Frag, title: str, start_text="Start", end_text="End", src=None) -> dict:
        start = self.box("start", start_text, None)
        end = self.box("end", end_text, None)
        frags = [start]
        if body.entry:
            frags.append(body)
        frags.append(end)
        out = self.seq(frags)
        # a join point that nothing reaches (every branch returned or raised) is dropped
        incoming = {e.dst_id for e in out.edges}
        dead = {n.id for n in out.nodes if n.kind == "merge" and n.id not in incoming}
        if dead:
            out.nodes = [n for n in out.nodes if n.id not in dead]
            out.edges = [e for e in out.edges if e.src_id not in dead and e.dst_id not in dead]
        # `return` inside a function: draw the jump back to the caller on the right-hand side
        end_node = next(n for n in out.nodes if n.kind == "end")
        rets = [n for n in out.nodes if n.kind == "return"]
        if end_text != "End" and rets:
            right = max(n.x + n.w / 2 for n in out.nodes) + 24
            for i, n in enumerate(rets):
                xr = right + 12 * i
                out.edges.append(Edge([(n.x + n.w / 2, n.y + n.h / 2), (xr, n.y + n.h / 2), (xr, end_node.y + end_node.h / 2), (end_node.x + end_node.w / 2, end_node.y + end_node.h / 2)], "", False, False, n.id, end_node.id))
            out.maxx = max(out.maxx, right + 12 * len(rets))
        minx = min(n.x - n.w / 2 for n in out.nodes)
        minx = min(minx, out.minx)
        maxx = max(max(n.x + n.w / 2 for n in out.nodes), out.maxx)
        pad = 24
        dx = pad - minx
        out.shift(dx, pad)
        width = maxx - minx + 2 * pad
        height = out.h + 2 * pad
        if width > MAX_WIDTH:
            raise TooBig("too wide (more than %d px)" % MAX_WIDTH)
        # the body's outline wrapped in start/end
        outline = [{"text": start_text + "."}] + body.outline + [{"text": end_text + "."}]
        return {"title": title, "w": round(width, 1), "h": round(height, 1),
                "nodes": [n.to_json() for n in out.nodes], "edges": [e.to_json() for e in out.edges], "outline": outline,
                **({"lines": list(src)} if src else {})}


def validate(chart: dict) -> list[str]:
    """Problems with a finished chart (empty list = fine): boxes off the canvas or on top of each other, edges off the
    canvas, boxes no arrow reaches. The build refuses a lesson whose charts have any."""
    bad: list[str] = []
    W_, H_ = chart["w"], chart["h"]
    targets = {e["to"] for e in chart["edges"]}
    real = [n for n in chart["nodes"] if n["kind"] != "merge"]
    for n in chart["nodes"]:
        if n["x"] - n["w"] / 2 < -0.5 or n["x"] + n["w"] / 2 > W_ + 0.5 or n["y"] < -0.5 or n["y"] + n["h"] > H_ + 0.5:
            bad.append(f"box outside the canvas: {n['text']}")
        if n["kind"] != "start" and n["id"] not in targets:
            bad.append(f"box nothing points to: {n['text']}")
    for i, a in enumerate(real):
        for b in real[i + 1:]:
            apart = (a["x"] + a["w"] / 2 <= b["x"] - b["w"] / 2 + 0.5 or b["x"] + b["w"] / 2 <= a["x"] - a["w"] / 2 + 0.5
                     or a["y"] + a["h"] <= b["y"] + 0.5 or b["y"] + b["h"] <= a["y"] + 0.5)
            if not apart:
                bad.append(f"boxes overlap: {a['text']} / {b['text']}")
    for e in chart["edges"]:
        for x, y in e["pts"]:
            if not (-0.5 <= x <= W_ + 0.5 and -0.5 <= y <= H_ + 0.5):
                bad.append(f"arrow leaves the canvas ({e['from']} -> {e['to']})")
                break
    return bad


def has_control_flow(tree: ast.AST) -> bool:
    return any(isinstance(n, (ast.If, ast.For, ast.While, ast.Try, ast.FunctionDef, ast.AsyncFor)) for n in ast.walk(tree))


def build(code: str) -> dict:
    """Returns {"charts": [...], "control": bool} or {"skip": reason}. Never raises on learner-style code."""
    code = code.replace("\r\n", "\n")
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return {"skip": f"does not parse as a program ({e.msg})"}
    if not tree.body:
        return {"skip": "empty"}
    try:  # ast.parse accepts things only the compiler rejects, such as break outside a loop or return outside a function
        compile(tree, "<example>", "exec")
    except SyntaxError as e:
        return {"skip": f"does not parse as a program ({e.msg})"}
    # a REPL transcript or a snippet that only shows a value is not a program worth drawing
    b = Builder(code.split("\n"))
    try:
        body = b.block(tree.body, {})
        main = b.finish(body, "The program")
    except TooBig as e:
        return {"skip": str(e)}
    charts = [main] + b.extra_charts
    problems = [f"{c['title']}: {p}" for c in charts for p in validate(c)]
    if problems:
        return {"error": problems}
    return {"charts": charts, "control": has_control_flow(tree)}


if __name__ == "__main__":  # python3 flowchart.py file.py  -> JSON on stdout
    json.dump(build(open(sys.argv[1], encoding="utf-8").read()), sys.stdout, indent=1)
