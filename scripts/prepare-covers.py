"""Create compact web delivery copies of the sourced photographs.

This only resizes and encodes: no compositing, drawing, recoloring, or cropping.
Run after downloading the sources listed in authentic-covers-*.json.
This is a manual authoring utility, not a production build dependency.
"""
from pathlib import Path
import json
import hashlib
import re
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ORIGINALS = ROOT / "artifacts" / "authentic-covers"
OUTPUT = ROOT / "public" / "images" / "blog"
OUTPUT.mkdir(parents=True, exist_ok=True)
manifest = []
photos = []
for provenance in sorted((ROOT / "src" / "content" / "research").glob("authentic-covers-*.json")):
    photos.extend(json.loads(provenance.read_text(encoding="utf-8-sig")))
if not photos:
    raise ValueError("No sourced photograph manifests found")
seen_slugs, seen_sources, seen_hashes = set(), set(), set()
for photo in photos:
    slug = photo["slug"]
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        raise ValueError(f"Invalid article slug: {slug}")
    source = (ROOT / photo["sourcePath"]).resolve()
    if not source.is_relative_to(ORIGINALS.resolve()):
        raise ValueError(f"Photo source must be in {ORIGINALS}")
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if slug in seen_slugs or photo["sourceUrl"] in seen_sources or digest in seen_hashes:
        raise ValueError(f"Duplicate photograph: {slug}")
    seen_slugs.add(slug)
    seen_sources.add(photo["sourceUrl"])
    seen_hashes.add(digest)
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
        for width, suffix in [(1536, ""), (768, "-768")]:
            result = image.copy()
            if result.width > width:
                result = result.resize((width, round(result.height * width / result.width)), Image.Resampling.LANCZOS)
            destination = OUTPUT / f"{slug}-photo{suffix}.webp"
            result.save(destination, "WEBP", quality=85, method=6)
            manifest.append({"slug": slug, "sourceSha256": digest, "width": result.width, "height": result.height,
                             "file": destination.relative_to(ROOT).as_posix(), "bytes": destination.stat().st_size})
(ROOT / "artifacts" / "photo-derivatives.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(f"Encoded {len(manifest)} WebP files from {len(manifest) // 2} original covers.")
print(f"Total delivery size: {sum(item['bytes'] for item in manifest):,} bytes")
