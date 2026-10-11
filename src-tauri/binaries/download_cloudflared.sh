#!/bin/bash
set -euo pipefail

# Enable debug output if --verbose passed
VERBOSE=false
TARGET=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --verbose) VERBOSE=true; shift ;;
    --target)
      if [[ $# -lt 2 ]]; then
        echo "Error: --target requires an argument" >&2
        exit 1
      fi
      TARGET="$2"; shift 2 ;;
    *) shift ;;  # Ignore other arguments
  esac
done

# Debug logging function
log() {
  if $VERBOSE || [[ "$1" == "ERROR" ]]; then
    echo "[$(date '+%T')] $1: $2"
  fi
}

# Configuration
VERSION="2026.10.0"
BIN_DIR="src-tauri/binaries"
log "INFO" "Creating binaries directory: $BIN_DIR"
mkdir -p "$BIN_DIR"

# Platform detection
RUNNER_OS="${RUNNER_OS:-UNKNOWN}"
log "INFO" "Detected RUNNER_OS: $RUNNER_OS"
log "INFO" "Current directory: $(pwd)"
log "INFO" "Target binary name: ${TARGET:-UNSPECIFIED}"

handle_error() {
  log "ERROR" "Failed at line $1"
  exit 1
}
trap 'handle_error $LINENO' ERR

# Determine download URL and output path based on target name
case "$TARGET" in
  "aarch64-apple-darwin")
    FILENAME="cloudflared-darwin-arm64.tgz"
    OUTPUT="cloudflared-$TARGET"
    ;;
  "x86_64-apple-darwin")
    FILENAME="cloudflared-darwin-amd64.tgz"
    OUTPUT="cloudflared-$TARGET"
    ;;
  "x86_64-unknown-linux-gnu")
    FILENAME="cloudflared-linux-amd64"
    OUTPUT="cloudflared-$TARGET"
    ;;
  "x86_64-pc-windows-msvc")
    FILENAME="cloudflared-windows-amd64.exe"
    OUTPUT="cloudflared-$TARGET.exe"
    ;;
  *)
    log "ERROR" "Unsupported target: $TARGET"
    exit 1
    ;;
esac

log "INFO" "Downloading binary: $FILENAME"
curl -fsSL "https://github.com/cloudflare/cloudflared/releases/download/$VERSION/$FILENAME" -o "$BIN_DIR/$OUTPUT"

# For macOS, we need to extract the tgz
if [[ "$TARGET" == *"apple-darwin"* ]]; then
  log "INFO" "Extracting macOS binary"
  mv "$BIN_DIR/$OUTPUT" temp.tgz
  tar xzf temp.tgz -C "$BIN_DIR"
  mv "$BIN_DIR/cloudflared" "$BIN_DIR/$OUTPUT"
  rm temp.tgz
fi

# Make executable (except Windows)
if [[ "$TARGET" != *".exe"* ]]; then
  chmod +x "$BIN_DIR/$OUTPUT"
fi

log "INFO" "Binary ready: $(ls -lh "$BIN_DIR/$OUTPUT")"
log "INFO" "Download completed successfully"
