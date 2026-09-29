#!/usr/bin/env python3
"""Package the multi-file Vite build (dist/) as a claude.ai Artifact page.

    npm run build:artifact          # = tsc && vite build && python3 tools/package_artifact.py

Input : dist/index.html + dist/assets/*   (built with base './', so every asset URL is relative)
Output: dist-artifact/
          index.html   the artifact page: NO <!doctype>/<html>/<head>/<body> (the host wraps it). Order:
                       <title>, Google Fonts links, styles (app CSS inlined), <div id="app">, module script
          assets/...   JS chunks, textures, binary meshes (copied verbatim)
          files.json   {"assets/x": {"from": "<abs path>", "contentType": "..."}} -> the Artifact tool's `files`
          manifest.json  sizes + limit checks

The artifact host limits: page and each text file <= 16 MB, each binary <= 15 MB, <= 255 files and
<= 64 MB per publish (more goes up in several publishes to the same url). The script fails loudly when a
limit is exceeded. JS resolves its assets with `new URL("x.jpg", import.meta.url)`, so assets/ must be
published next to the entry chunk (it is: same folder).
"""
from __future__ import annotations

import argparse
import html
import json
import mimetypes
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TITLE = "David the Shepherd"
BASE_STYLE = ":root{color-scheme:dark}html,body{height:100%;margin:0;background:#0b0806;overflow:hidden}"
TYPES = {
    ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif",
    ".ktx2": "image/ktx2", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json",
    ".bin": "application/octet-stream", ".wasm": "application/wasm", ".woff2": "font/woff2", ".woff": "font/woff",
    ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp4": "video/mp4", ".webm": "video/webm",
    ".txt": "text/plain", ".hdr": "application/octet-stream", ".exr": "application/octet-stream",
}
TEXT_EXT = {".js", ".mjs", ".css", ".json", ".svg", ".gltf", ".txt"}
MB = 1024 * 1024
LIMIT_PAGE = 16 * MB
LIMIT_TEXT = 16 * MB
LIMIT_BIN = 15 * MB
LIMIT_FILES = 255
LIMIT_PUBLISH = 64 * MB


def attr(tag: str, name: str) -> str | None:
    m = re.search(r'\b' + name + r'\s*=\s*("([^"]*)"|\'([^\']*)\')', tag)
    return None if not m else (m.group(2) if m.group(2) is not None else m.group(3))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dist", default=str(ROOT / "dist"))
    ap.add_argument("--out", default=str(ROOT / "dist-artifact"))
    ap.add_argument("--title", default=TITLE)
    a = ap.parse_args()
    dist, out = Path(a.dist).resolve(), Path(a.out).resolve()
    src = (dist / "index.html").read_text(encoding="utf-8")

    fonts: list[str] = []
    styles: list[str] = []
    scripts: list[str] = []
    preloads: list[str] = []
    for tag in re.findall(r"<link\b[^>]*>", src, flags=re.I):
        href = attr(tag, "href") or ""
        rel = (attr(tag, "rel") or "").lower()
        if "fonts.googleapis.com" in href or "fonts.gstatic.com" in href:
            fonts.append(tag)
        elif rel == "stylesheet":
            css_path = (dist / href).resolve()
            css = css_path.read_text(encoding="utf-8")
            # url(...) in the CSS is relative to the CSS file; after inlining it is relative to the page
            rel_dir = css_path.parent.relative_to(dist).as_posix()

            def fix(m: re.Match[str]) -> str:
                u = m.group(2)
                if re.match(r"^(data:|https?:|/|#)", u):
                    return m.group(0)
                return f"url({m.group(1)}./{rel_dir}/{u.lstrip('./')}{m.group(1)})"

            css = re.sub(r"url\(\s*(['\"]?)([^'\")]+)\1\s*\)", fix, css)
            styles.append(f"<style>{css}</style>")
        elif rel == "modulepreload":
            preloads.append(f'<link rel="modulepreload" href="{html.escape(href)}" />')
    for tag in re.findall(r"<script\b[^>]*>\s*</script>", src, flags=re.I | re.S):
        s = attr(tag, "src")
        if s:
            scripts.append(f'<script type="module" src="{html.escape(s)}"></script>')
    inline_scripts = [m for m in re.findall(r"<script\b(?![^>]*\bsrc=)[^>]*>(.*?)</script>", src, flags=re.I | re.S) if m.strip()]
    inline_styles = re.findall(r"<style\b[^>]*>(.*?)</style>", src, flags=re.I | re.S)
    if not scripts:
        print("error: no module script found in", dist / "index.html", file=sys.stderr)
        return 1

    page = "\n".join(
        [f"<title>{html.escape(a.title)}</title>"]
        + fonts
        + [f"<style>{BASE_STYLE}</style>"]
        + [f"<style>{s}</style>" for s in inline_styles]
        + styles
        + ['<div id="app"></div>']
        + [f"<script>{s}</script>" for s in inline_scripts]
        + preloads
        + scripts
    ) + "\n"
    bad = re.search(r"<!doctype|<html\b|<head\b|<body\b|</html>|</head>|</body>", page, flags=re.I)
    if bad:
        print(f"error: page still contains a document tag: {bad.group(0)}", file=sys.stderr)
        return 1

    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    (out / "index.html").write_text(page, encoding="utf-8")
    files: dict[str, dict[str, str]] = {}
    manifest = {"page": {"path": "index.html", "bytes": len(page.encode())}, "files": [], "errors": []}
    total = len(page.encode())
    for f in sorted((dist / "assets").rglob("*")):
        if not f.is_file():
            continue
        rel = f.relative_to(dist).as_posix()
        dst = out / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, dst)
        size = f.stat().st_size
        total += size
        ext = f.suffix.lower()
        ctype = TYPES.get(ext) or mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        files[rel] = {"from": str(dst), "contentType": ctype}
        limit = LIMIT_TEXT if ext in TEXT_EXT else LIMIT_BIN
        manifest["files"].append({"path": rel, "bytes": size, "contentType": ctype})
        if size > limit:
            manifest["errors"].append(f"{rel}: {size / MB:.1f} MB exceeds the {limit / MB:.0f} MB limit")
    # other top-level files emitted by vite (public/ dir copies), excluding index.html
    for f in sorted(dist.iterdir()):
        if f.is_file() and f.name != "index.html":
            rel = f.name
            shutil.copy2(f, out / rel)
            files[rel] = {"from": str(out / rel), "contentType": TYPES.get(f.suffix.lower()) or "application/octet-stream"}
            total += f.stat().st_size
            manifest["files"].append({"path": rel, "bytes": f.stat().st_size, "contentType": files[rel]["contentType"]})
    if len(page.encode()) > LIMIT_PAGE:
        manifest["errors"].append("page exceeds 16 MB")
    if len(files) > LIMIT_FILES:
        manifest["errors"].append(f"{len(files)} files > {LIMIT_FILES} per publish: publish in several batches to the same url")
    if total > LIMIT_PUBLISH:
        manifest["errors"].append(f"{total / MB:.1f} MB > 64 MB per publish: publish in several batches to the same url")
    manifest["totalBytes"] = total
    manifest["fileCount"] = len(files)
    (out / "files.json").write_text(json.dumps(files, indent=2), encoding="utf-8")
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"artifact page: {out / 'index.html'} ({len(page.encode()) / 1024:.1f} KB)")
    print(f"assets: {len(files)} files, {total / MB:.2f} MB total -> {out / 'files.json'}")
    for e in manifest["errors"]:
        print("LIMIT:", e, file=sys.stderr)
    return 2 if manifest["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
