#!/bin/sh

set -eu

APP_ROOT="$(cd "$(dirname "$0")" && pwd)"
VENDOR_DIR="$APP_ROOT/.vendor"

if [ ! -d "$VENDOR_DIR" ] || [ -z "$(ls -A "$VENDOR_DIR")" ]; then
  echo "Installing Python dependencies into $VENDOR_DIR..."
  python3 -m pip install --no-cache-dir --upgrade pip
  python3 -m pip install --no-cache-dir -r "$APP_ROOT/requirements.txt" --target "$VENDOR_DIR"
fi

export PYTHONPATH="$VENDOR_DIR${PYTHONPATH:+:}$PYTHONPATH"

python3 app.py