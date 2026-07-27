"""Subset source fonts to only the glyphs currently used by the website."""

from pathlib import Path
from fontTools import subset

ROOT = Path(__file__).resolve().parents[1]
SOURCE_EXTENSIONS = {".vue", ".ts", ".css", ".md"}
EXTRA_GLYPHS = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    " ·—–/\\()[]{}<>:;,.!?！？、，。：“”‘’（）《》【】#%&+*=—_￥®©↗→↓✱✚▶"
)

text = EXTRA_GLYPHS
for path in ROOT.rglob("*"):
    if path.suffix in SOURCE_EXTENSIONS and not {"node_modules", ".nuxt", ".output"}.intersection(path.parts):
        text += path.read_text(encoding="utf-8")

for name in ("nano-byong-gye-hei", "lemi-xiang-su-ti"):
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
