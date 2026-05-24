# IDX Screener Website

Static GitHub Pages website for the IDX VWAP screener.

## How It Works

- `IDX_Screener.py` runs the existing screener and creates an Excel workbook in `Output/`.
- `scripts/export_latest.py` converts the latest workbook into `docs/data/YYYY-MM-DD.json`.
- `docs/index.html` reads `docs/data/manifest.json` and lets you choose which market date to display.
- `.github/workflows/idx-screener-pages.yml` runs every weekday at 17:00 WIB and deploys `docs/` to GitHub Pages.

## GitHub Setup

1. Create a new GitHub repository.
2. Push these files to the `main` branch.
3. Open the repository on GitHub, then go to `Settings` -> `Pages`.
4. Set `Source` to `GitHub Actions`.
5. Open the `Actions` tab and run `IDX Screener Pages` manually once.

The scheduled run uses `10:00 UTC`, which is `17:00 WIB`.
