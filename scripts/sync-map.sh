#!/usr/bin/env bash
# Copies the public map build from the private brunogarcia-map repo into static/travel/: the same map as
# where.was.bruno.garcia.in, with no Options panel and only the data it draws. Build first with
# `npm run build:public` in web/. Its page and Cloudflare files are left out; Hugo serves its own page at
# /travel/, and the build's relative URLs resolve from there. Source maps would embed the private source.
set -euo pipefail

src="${1:-../brunogarcia-map/web/dist-public}"
dest="$(dirname "$0")/../static/travel"

test -f "$src/map.js" || { echo "no map bundle in $src; run npm run build:public in brunogarcia-map/web" >&2; exit 1; }

rm -rf "$dest"
mkdir -p "$dest"
rsync -a --exclude '*.map' --exclude '.gitkeep' --exclude 'index.html' --exclude '404.html' \
  --exclude '_headers' --exclude '_redirects' "$src/" "$dest/"

# The landing page's small globe: land outlines, and every place visited rounded to half a degree.
mkdir -p "$dest/mini"
cp "$src/../src/map/fallback/land-110m.json" "$dest/mini/land.json"
jq -c '[.[] | [((.lat*2|round)/2), ((.lon*2|round)/2)]] | unique | flatten' "$dest/data/stays.json" > "$dest/mini/points.json"

echo "synced $(find "$dest" -type f | wc -l | tr -d ' ') files from $src"
