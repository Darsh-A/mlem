# mlem - Desktop Cat Pet

A desktop pet cat that lives on your screen. Built with Tauri v2 + Svelte 5.

## Features

- Transparent, always-on-top cat that roams your desktop
- Animations: idle, walking, sitting, sleeping
- Click to pet, drag to reposition
- Right-click context menu
- System tray icon
- Random speech bubbles
- Cross-platform: Linux and Windows

## Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Node.js](https://nodejs.org/) v18+
- Linux system libraries (Arch): `webkit2gtk-4.1 libappindicator-gtk3 librsvg gtk3`

## Setup

```bash
npm install
```

## Development

```bash
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Adding Sprites

Export your Aseprite files as sprite sheets:
1. Open `.aseprite` file in Aseprite
2. File → Export Sprite Sheet → Output: PNG + JSON (Array format)
3. Save to `public/sprites/`

See `public/sprites/README.md` for details.

The app runs with placeholder sprites if no exports are found.
