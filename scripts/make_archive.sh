#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
ARCHIVE_NAME="kyzlo-quant.zip"
ARCHIVE_PATH="$DIST_DIR/$ARCHIVE_NAME"

mkdir -p "$DIST_DIR"

git -C "$ROOT_DIR" archive --format=zip --output="$ARCHIVE_PATH" HEAD

echo "Local file URL: file://$ARCHIVE_PATH"
echo "To serve over HTTP, run: python -m http.server 8000 --directory \"$DIST_DIR\""
echo "Then download from: http://localhost:8000/$ARCHIVE_NAME"
