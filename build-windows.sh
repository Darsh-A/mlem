#!/usr/bin/env bash
#
# Build mlem as a standalone Windows .exe installer/bundle
#
# Prerequisites (installed automatically on first run):
#   - Rust target: x86_64-pc-windows-msvc  (via rustup)
#   - NSIS (for .exe installer):  sudo apt install nsis
#   - cargo-xwin or cross for cross-compilation from Linux
#
# Usage:
#   ./build-windows.sh          # Build using GitHub Actions (recommended)
#   ./build-windows.sh local    # Attempt local cross-compilation with cargo-xwin
#
set -euo pipefail

# Source Rust/Cargo environment if available
if [ -f "$HOME/.cargo/env" ]; then
    . "$HOME/.cargo/env"
fi

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "  mlem - Windows .exe Build Script"
echo "=========================================="

# ─── Option 1: Local cross-compilation with cargo-xwin ───
build_local() {
    echo ""
    echo "[1/5] Checking prerequisites..."

    # Ensure rustup is available (needed for cross-compilation targets)
    if ! command -v rustup &>/dev/null; then
        echo "  -> rustup not found. It's required for cross-compilation targets."
        echo "  -> You have system Rust ($(cargo --version 2>/dev/null || echo 'unknown'))."
        echo "  -> Installing rustup (will manage alongside system Rust)..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
        . "$HOME/.cargo/env"
    fi

    # Ensure Rust Windows target is installed
    if ! rustup target list --installed | grep -q "x86_64-pc-windows-msvc"; then
        echo "  -> Installing Rust target x86_64-pc-windows-msvc..."
        rustup target add x86_64-pc-windows-msvc
    else
        echo "  -> Rust target x86_64-pc-windows-msvc already installed."
    fi

    # Ensure cargo-xwin is installed (cross-compile using MSVC CRT from Linux)
    if ! command -v cargo-xwin &>/dev/null; then
        echo "  -> Installing cargo-xwin..."
        cargo install cargo-xwin
    else
        echo "  -> cargo-xwin already installed."
    fi

    # Ensure NSIS is installed (needed for Tauri .exe installer bundle)
    if ! command -v makensis &>/dev/null; then
        echo "  -> NSIS not found. Installing..."
        if command -v apt &>/dev/null; then
            sudo apt install -y nsis
        elif command -v yay &>/dev/null; then
            yay -S --noconfirm nsis
        elif command -v paru &>/dev/null; then
            paru -S --noconfirm nsis
        elif command -v pacman &>/dev/null; then
            echo "  -> NSIS is in the AUR. Installing with makepkg..."
            NSIS_TMP="$(mktemp -d)"
            git clone https://aur.archlinux.org/nsis.git "$NSIS_TMP/nsis"
            cd "$NSIS_TMP/nsis"
            makepkg -si --noconfirm
            cd "$PROJECT_ROOT"
            rm -rf "$NSIS_TMP"
        elif command -v dnf &>/dev/null; then
            sudo dnf install -y nsis
        else
            echo "ERROR: Please install NSIS manually (https://nsis.sourceforge.io)"
            exit 1
        fi
    else
        echo "  -> NSIS already installed."
    fi

    echo ""
    echo "[2/5] Building frontend..."
    npm install
    npm run build

    echo ""
    echo "[3/5] Cross-compiling Tauri for Windows (x86_64)..."
    cd src-tauri
    cargo xwin build --release --target x86_64-pc-windows-msvc
    cd ..

    echo ""
    echo "[4/5] Building Tauri bundle for Windows..."
    npx tauri build --target x86_64-pc-windows-msvc

    echo ""
    echo "[5/5] Done!"
    echo ""
    echo "=========================================="
    echo "  Build artifacts:"
    echo "=========================================="

    BUNDLE_DIR="src-tauri/target/x86_64-pc-windows-msvc/release/bundle"
    if [ -d "$BUNDLE_DIR/nsis" ]; then
        echo "  NSIS Installer: $BUNDLE_DIR/nsis/"
        ls -lh "$BUNDLE_DIR/nsis/"*.exe 2>/dev/null || true
    fi
    if [ -d "$BUNDLE_DIR/msi" ]; then
        echo "  MSI Installer:  $BUNDLE_DIR/msi/"
        ls -lh "$BUNDLE_DIR/msi/"*.msi 2>/dev/null || true
    fi

    EXE_PATH="src-tauri/target/x86_64-pc-windows-msvc/release/mlem.exe"
    if [ -f "$EXE_PATH" ]; then
        echo "  Standalone EXE: $EXE_PATH"
        ls -lh "$EXE_PATH"
    fi
    echo ""
}

# ─── Option 2: GitHub Actions CI (recommended) ───
setup_github_actions() {
    echo ""
    echo "Setting up GitHub Actions workflow for Windows builds..."

    mkdir -p .github/workflows

    cat > .github/workflows/build-windows.yml << 'WORKFLOW_EOF'
name: Build Windows Executable

on:
  workflow_dispatch:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install frontend dependencies
        run: npm install

      - name: Build Tauri app for Windows
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'mlem v__VERSION__'
          releaseBody: 'Desktop cat pet for Windows'
          releaseDraft: true
          prerelease: false

      - name: Upload Windows artifacts
        uses: actions/upload-artifact@v4
        with:
          name: mlem-windows
          path: |
            src-tauri/target/release/bundle/nsis/*.exe
            src-tauri/target/release/bundle/msi/*.msi
            src-tauri/target/release/mlem.exe
WORKFLOW_EOF

    echo "  -> Created .github/workflows/build-windows.yml"
    echo ""
    echo "=========================================="
    echo "  GitHub Actions workflow created!"
    echo "=========================================="
    echo ""
    echo "  How to use:"
    echo "    1. Push this repo to GitHub"
    echo "    2. Go to Actions tab -> 'Build Windows Executable'"
    echo "    3. Click 'Run workflow' to manually trigger a build"
    echo "    4. Or push a tag (e.g., git tag v0.1.0 && git push --tags)"
    echo "    5. Download the .exe from the workflow artifacts"
    echo ""
}

# ─── Main ───
case "${1:-}" in
    local)
        build_local
        ;;
    ci|github|actions)
        setup_github_actions
        ;;
    *)
        echo ""
        echo "Cross-compiling Tauri from Linux to Windows is complex."
        echo "Choose a build strategy:"
        echo ""
        echo "  ./build-windows.sh local    - Cross-compile locally (needs cargo-xwin + NSIS)"
        echo "  ./build-windows.sh ci       - Set up GitHub Actions (recommended, builds on real Windows)"
        echo ""
        echo "Recommendation: Use 'ci' for reliable builds, 'local' for quick iteration."
        echo ""
        
        read -rp "Set up GitHub Actions workflow now? [Y/n] " choice
        case "$choice" in
            [nN]*)
                echo "Run './build-windows.sh local' to try local cross-compilation."
                ;;
            *)
                setup_github_actions
                ;;
        esac
        ;;
esac
