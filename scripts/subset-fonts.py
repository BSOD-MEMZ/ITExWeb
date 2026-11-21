"""Subset source fonts to only the glyphs currently used by the website.

正文与等宽标签统一用 Cubic（`public/fonts/Cubic_11.woff2`，约 400 KB，不做子集化，
直接用原文件），所以这里只需要处理标题用的 Nano。Lemi 已退役，源文件也已删除。
"""

from pathlib import Path
from fontTools import subset

ROOT = Path(__file__).resolve().parents[1]
SOURCE_EXTENSIONS = {".vue", ".ts", ".css", ".md"}
EXTRA_GLYPHS = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    " ·—–/\\()[]{}<>:;,.!?！？、，。：“”‘’（）《》【】#%&+*=—_￥®©↗→↓←↑✱✚▶"
)

text = EXTRA_GLYPHS
for path in ROOT.rglob("*"):
    if path.suffix in SOURCE_EXTENSIONS and not {"node_modules", ".nuxt", ".output"}.intersection(path.parts):
        text += path.read_text(encoding="utf-8")

for name in ("nano-byong-gye-hei",):
    source = ROOT / "font-source" / f"{name}.woff2"
    target = ROOT / "public" / "fonts" / f"{name}.woff2"
    options = subset.Options()
    options.flavor = "woff2"
    font = subset.load_font(source, options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    subset.save_font(font, target, options)
    print(f"{source.name}: {source.stat().st_size} -> {target.stat().st_size} bytes")
