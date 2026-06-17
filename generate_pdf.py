"""
Generate a polished PDF from README.md using ReportLab.
Fixes: cover page, paragraph accumulation, code block styling,
       blockquote borders, solid header/footer.
"""
import re
import os
from pathlib import Path
from datetime import date
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, Preformatted, PageBreak,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

README = Path(__file__).parent / "README.md"
OUTPUT = Path(__file__).parent / "WealthVault_Documentation.pdf"

# ── Font registration ──────────────────────────────────────────────────────
_MONO = "Courier"
_WIN_FONTS = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"

def _reg(name, fname):
    p = _WIN_FONTS / fname
    if p.exists():
        try:
            pdfmetrics.registerFont(TTFont(name, str(p)))
            return True
        except Exception:
            return False
    return False

for _fn, _ff in [("ConsolasU","consola.ttf"),("LucidaConsole","lucon.ttf"),("CourierNew","cour.ttf")]:
    if _reg(_fn, _ff):
        _MONO = _fn
        print(f"Font: {_fn}")
        break
else:
    print("Warning: using fallback Courier.")

# ── Palette ────────────────────────────────────────────────────────────────
NAVY    = colors.HexColor("#0f2a4e")
BLUE    = colors.HexColor("#1e40af")
LBLUE   = colors.HexColor("#2563eb")
ACCENT  = colors.HexColor("#3b82f6")
CODE_BG = colors.HexColor("#f1f5f9")
QBKG    = colors.HexColor("#eff6ff")
BORDER  = colors.HexColor("#cbd5e1")
TEXT    = colors.HexColor("#1e293b")
MUTED   = colors.HexColor("#64748b")
THEAD   = colors.HexColor("#0f2a4e")
TALT    = colors.HexColor("#f8fafc")

W, H  = A4
LM = RM = 18 * mm
CW = W - LM - RM   # content width ≈ 493 pt

# ── Styles ─────────────────────────────────────────────────────────────────
def _s(n, **kw): return ParagraphStyle(n, **kw)

S = {
    "h1":   _s("H1",  fontSize=20, leading=26, textColor=NAVY,  fontName="Helvetica-Bold",
                spaceAfter=8,  spaceBefore=4),
    "h2":   _s("H2",  fontSize=13, leading=18, textColor=BLUE,  fontName="Helvetica-Bold",
                spaceAfter=5,  spaceBefore=14),
    "h3":   _s("H3",  fontSize=11, leading=15, textColor=LBLUE, fontName="Helvetica-Bold",
                spaceAfter=4,  spaceBefore=10),
    "h4":   _s("H4",  fontSize=10, leading=14, textColor=TEXT,  fontName="Helvetica-Bold",
                spaceAfter=3,  spaceBefore=7),
    "body": _s("Body",fontSize=9.5,leading=15, textColor=TEXT,  fontName="Helvetica",
                spaceAfter=5,  alignment=TA_JUSTIFY),
    "bul":  _s("Bul", fontSize=9.5,leading=14, textColor=TEXT,  fontName="Helvetica",
                leftIndent=16, spaceAfter=2),
    "meta": _s("Meta",fontSize=8,  leading=11, textColor=MUTED, fontName="Helvetica-Oblique"),
}
_TH = _s("TH", fontSize=8, leading=11, textColor=colors.white, fontName="Helvetica-Bold")
_TD = _s("TD", fontSize=8, leading=11, textColor=TEXT,         fontName="Helvetica")


# ── Inline markdown → ReportLab XML ───────────────────────────────────────
def md_inline(text: str) -> str:
    # strip links
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)
    # save inline code spans before escaping
    spans: dict = {}
    def _save(m):
        k = f"\x00C{len(spans)}\x00"
        inner = m.group(1).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
        spans[k] = f'<font name="{_MONO}" size="8"><b>{inner}</b></font>'
        return k
    text = re.sub(r"`([^`]+)`", _save, text)
    text = text.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
    text = re.sub(r"\*\*\*(.+?)\*\*\*", r"<b><i>\1</i></b>", text)
    text = re.sub(r"\*\*(.+?)\*\*",     r"<b>\1</b>",         text)
    text = re.sub(r"\*(.+?)\*",         r"<i>\1</i>",         text)
    text = re.sub(r"(?<!\w)_(.+?)_(?!\w)", r"<i>\1</i>",      text)
    for k, v in spans.items():
        text = text.replace(k, v)
    return text


# ── Table helpers ──────────────────────────────────────────────────────────
def _parse_table(lines):
    rows = []
    for ln in lines:
        ln = ln.strip()
        if not ln.startswith("|"): continue
        if re.match(r"^\|[\s\-|:]+\|$", ln): continue
        rows.append([c.strip() for c in ln.strip("|").split("|")])
    return rows

def _make_table(rows):
    if not rows: return None
    cols = max(len(r) for r in rows)
    data = []
    for ri, row in enumerate(rows):
        while len(row) < cols: row.append("")
        sty = _TH if ri == 0 else _TD
        data.append([Paragraph(md_inline(c), sty) for c in row])
    cw = CW / cols
    t = Table(data, colWidths=[cw]*cols, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,0),  THEAD),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [colors.white, TALT]),
        ("GRID",          (0,0),(-1,-1), 0.4, BORDER),
        ("VALIGN",        (0,0),(-1,-1), "TOP"),
        ("LEFTPADDING",   (0,0),(-1,-1), 6),
        ("RIGHTPADDING",  (0,0),(-1,-1), 6),
        ("TOPPADDING",    (0,0),(-1,-1), 4),
        ("BOTTOMPADDING", (0,0),(-1,-1), 4),
    ]))
    return t


# ── Box-drawing → ASCII ────────────────────────────────────────────────────
_BOX = str.maketrans({
    "┌":"+","┐":"+","└":"+","┘":"+","├":"+","┤":"+","┬":"+","┴":"+","┼":"+",
    "─":"-","│":"|",
    "╔":"+","╗":"+","╚":"+","╝":"+","╠":"+","╣":"+","╦":"+","╩":"+","╬":"+",
    "═":"=","║":"|",
    "▼":"v","▲":"^","►":">","◄":"<","→":"->","←":"<-","↑":"^","↓":"v",
    "•":"*","·":".","✓":"OK","✗":"X","✔":"OK","✘":"X",
    "❤":"<3","🚀":"[>>]","✅":"[OK]","❌":"[X]","⚠":"[!]","❓":"[?]","🛑":"[STOP]",
    "‘":"'","’":"'","“":'"',"”":'"',"–":"-","—":"--","…":"...",
})
def _ascii(t): return t.translate(_BOX)


# ── Styled boxes ───────────────────────────────────────────────────────────
# Preformatted is page-splittable; Table with 1 row is not — so we use
# backColor + borderColor in ParagraphStyle to get the box look without
# wrapping in a Table that would trigger a LayoutError on tall diagrams.
_CODE_STY = _s("CB",
    fontSize=7.5, leading=11, fontName=_MONO, textColor=TEXT,
    backColor=CODE_BG,
    borderColor=BORDER, borderWidth=0.5, borderPadding=8,
    spaceBefore=6, spaceAfter=8,
)
_QUOTE_STY = _s("QB",
    fontSize=9, leading=14, textColor=BLUE, fontName="Helvetica-Oblique",
    backColor=QBKG,
    borderColor=colors.HexColor("#bfdbfe"), borderWidth=0.5, borderPadding=8,
    spaceBefore=4, spaceAfter=8,
)

def code_box(text: str):
    return Preformatted(text, _CODE_STY)

def quote_box(txt: str):
    return Paragraph(f"<i>{txt}</i>", _QUOTE_STY)


# ── Page callbacks ─────────────────────────────────────────────────────────
def on_cover(canvas, doc):
    canvas.saveState()
    # Full navy background
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # Accent horizontal bar
    canvas.setFillColor(LBLUE)
    canvas.rect(LM, H * 0.435, CW, 3, fill=1, stroke=0)
    # Title
    canvas.setFont("Helvetica-Bold", 38)
    canvas.setFillColor(colors.white)
    canvas.drawCentredString(W/2, H * 0.54, "WealthVault")
    # Subtitle
    canvas.setFont("Helvetica", 15)
    canvas.setFillColor(colors.HexColor("#93c5fd"))
    canvas.drawCentredString(W/2, H * 0.475, "AI-Powered Banking Platform")
    # Bank / event line
    canvas.setFont("Helvetica-Oblique", 11)
    canvas.setFillColor(colors.HexColor("#bfdbfe"))
    canvas.drawCentredString(W/2, H * 0.415,
        "Punjab & Sind Bank  ·  Hackathon 2026")
    # Team
    canvas.setFont("Helvetica", 9.5)
    canvas.setFillColor(colors.HexColor("#7dd3fc"))
    canvas.drawCentredString(W/2, H * 0.13,
        "Team: Madhur Prakash & Saisha Goel")
    canvas.drawCentredString(W/2, H * 0.10,
        f"Generated {date.today().strftime('%B %d, %Y')}")
    # Bottom strip
    canvas.setFillColor(colors.HexColor("#1e3a5f"))
    canvas.rect(0, 0, W, 14*mm, fill=1, stroke=0)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#93c5fd"))
    canvas.drawCentredString(W/2, 5*mm,
        "CONFIDENTIAL  ·  HACKATHON PROJECT DOCUMENTATION")
    canvas.restoreState()


def on_page(canvas, doc):
    canvas.saveState()
    # Header bar
    canvas.setFillColor(NAVY)
    canvas.rect(0, H - 14*mm, W, 14*mm, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.setFillColor(colors.white)
    canvas.drawString(LM, H - 8.5*mm, "WealthVault  ·  PSB Banking Platform")
    canvas.setFont("Helvetica", 7.5)
    canvas.drawRightString(W - RM, H - 8.5*mm, "Confidential")
    # Footer bar
    canvas.setFillColor(colors.HexColor("#f8fafc"))
    canvas.rect(0, 0, W, 11*mm, fill=1, stroke=0)
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(0, 11*mm, W, 11*mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(W/2, 4*mm, f"Page {doc.page}")
    canvas.restoreState()


# ── Body-line classifier ───────────────────────────────────────────────────
def _is_body(ln: str) -> bool:
    s = ln.strip()
    if not s:                              return False
    if s.startswith("#"):                  return False
    if s.startswith("```"):               return False
    if s.startswith("|"):                  return False
    if s.startswith("> "):                 return False
    if re.match(r"^\s*[-*+] ", ln):       return False
    if re.match(r"^\d+\. ", s):           return False
    if re.match(r"^---+$", s):            return False
    if re.match(r"^\*\*\*+$", s):         return False
    return True


# ── Main parser: markdown → ReportLab flowables ────────────────────────────
def parse(text: str) -> list:
    # Page 1 = cover drawn entirely by on_cover; PageBreak moves to page 2.
    out = [PageBreak()]
    lines = text.splitlines()
    i, n = 0, len(lines)
    first_h1 = True

    while i < n:
        ln = lines[i]

        # ── Fenced code block ───────────────────────────────────────────────
        if ln.strip().startswith("```"):
            code = []
            i += 1
            while i < n and not lines[i].strip().startswith("```"):
                code.append(lines[i])
                i += 1
            i += 1
            out.append(code_box(_ascii("\n".join(code))))
            out.append(Spacer(1, 6))
            continue

        # ── Markdown table ──────────────────────────────────────────────────
        if ln.strip().startswith("|"):
            tbl_lines = []
            while i < n and lines[i].strip().startswith("|"):
                tbl_lines.append(lines[i]); i += 1
            t = _make_table(_parse_table(tbl_lines))
            if t:
                out.append(KeepTogether([t, Spacer(1, 8)]))
            continue

        # ── Horizontal rule ─────────────────────────────────────────────────
        if re.match(r"^---+$", ln.strip()) or re.match(r"^\*\*\*+$", ln.strip()):
            out.append(HRFlowable(width="100%", thickness=0.5,
                                  color=BORDER, spaceAfter=8, spaceBefore=8))
            i += 1; continue

        # ── H1 ──────────────────────────────────────────────────────────────
        if ln.startswith("# ") and not ln.startswith("## "):
            if not first_h1:
                out.append(PageBreak())
            first_h1 = False
            out.append(Paragraph(md_inline(ln[2:].strip()), S["h1"]))
            out.append(HRFlowable(width="100%", thickness=2,
                                  color=LBLUE, spaceAfter=8))
            i += 1; continue

        # ── H2 ──────────────────────────────────────────────────────────────
        if ln.startswith("## ") and not ln.startswith("### "):
            p  = Paragraph(md_inline(ln[3:].strip()), S["h2"])
            hr = HRFlowable(width="100%", thickness=0.5,
                            color=colors.HexColor("#bfdbfe"), spaceAfter=4)
            out.append(KeepTogether([p, hr]))
            i += 1; continue

        # ── H3 ──────────────────────────────────────────────────────────────
        if ln.startswith("### "):
            out.append(Paragraph(md_inline(ln[4:].strip()), S["h3"]))
            i += 1; continue

        # ── H4 ──────────────────────────────────────────────────────────────
        if ln.startswith("#### "):
            out.append(Paragraph(md_inline(ln[5:].strip()), S["h4"]))
            i += 1; continue

        # ── Blockquote (accumulate multi-line) ──────────────────────────────
        if ln.startswith("> "):
            parts = []
            while i < n and lines[i].startswith("> "):
                parts.append(lines[i][2:].strip()); i += 1
            out.append(quote_box(md_inline(" ".join(parts))))
            out.append(Spacer(1, 4))
            continue

        # ── Bullet list ─────────────────────────────────────────────────────
        if re.match(r"^(\s*)[-*+] ", ln):
            lvl = len(ln) - len(ln.lstrip())
            txt = md_inline(re.sub(r"^(\s*)[-*+] ", "", ln).strip())
            sty = ParagraphStyle("Bsub", parent=S["bul"], leftIndent=16 + lvl*8)
            out.append(Paragraph(f"• {txt}", sty))
            i += 1; continue

        # ── Numbered list ────────────────────────────────────────────────────
        m = re.match(r"^(\d+)\. (.+)", ln)
        if m:
            out.append(Paragraph(
                f"{m.group(1)}. {md_inline(m.group(2))}", S["bul"]))
            i += 1; continue

        # ── Blank line ───────────────────────────────────────────────────────
        if not ln.strip():
            out.append(Spacer(1, 4))
            i += 1; continue

        # ── Body paragraph — accumulate consecutive body lines ───────────────
        parts = []
        while i < n and _is_body(lines[i]):
            parts.append(lines[i].strip()); i += 1
        txt = md_inline(" ".join(parts))
        if txt:
            out.append(Paragraph(txt, S["body"]))

    return out


# ── Entry point ────────────────────────────────────────────────────────────
def main():
    print(f"Reading {README} ...")
    text = README.read_text(encoding="utf-8")

    print("Building PDF ...")
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4,
        topMargin=20*mm, bottomMargin=18*mm,
        leftMargin=LM,   rightMargin=RM,
        title="WealthVault — PSB Banking Platform Documentation",
        author="WealthVault Team",
        subject="Full-stack banking · architecture · security · API reference",
    )
    doc.build(parse(text), onFirstPage=on_cover, onLaterPages=on_page)

    kb = OUTPUT.stat().st_size / 1024
    print(f"\nDone  {OUTPUT}")
    print(f"Size  {kb:.0f} KB   font={_MONO}")


if __name__ == "__main__":
    main()
