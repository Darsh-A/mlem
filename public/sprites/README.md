# Sprite Sheets

Place your exported Aseprite sprite sheets here.

## How to export from Aseprite

For each `.aseprite` file in `assets/`:

1. Open the file in Aseprite
2. Go to **File → Export Sprite Sheet**
3. Set **Sheet Type** to "By Rows" (or "Packed" — both work)
4. Under **Output**:
   - Check **Output File** → set to `public/sprites/<name>.png`
   - Check **JSON Data** → set to `public/sprites/<name>.json`
   - Set JSON format to **Array**
5. Click **Export**

### Expected files

| Aseprite file            | Export as                                        |
| ------------------------ | ------------------------------------------------ |
| `petha_default.aseprite` | `petha_default.png` + `petha_default.json`       |
| `petha_sit.aseprite`     | `petha_sit.png` + `petha_sit.json`               |
| `petha_sleep.aseprite`   | `petha_sleep.png` + `petha_sleep.json`            |
| `cat_icon.aseprite`      | `../src-tauri/icons/icon.png` (single frame PNG) |

The game will automatically use **placeholder sprites** for any missing files,
so you can run the app immediately and add real sprites later.
