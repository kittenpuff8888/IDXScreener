from __future__ import annotations

import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    market_date = os.environ.get("MARKET_DATE")
    if not market_date:
        market_date = datetime.now(ZoneInfo("Asia/Jakarta")).strftime("%Y-%m-%d")

    env = os.environ.copy()
    env["MARKET_DATE"] = market_date

    subprocess.run([sys.executable, str(ROOT / "IDX_Screener.py")], cwd=ROOT, env=env, check=True)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "export_latest.py")], cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
