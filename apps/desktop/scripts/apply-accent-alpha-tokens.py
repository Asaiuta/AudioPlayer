#!/usr/bin/env python3
"""Replace ad-hoc `color-mix(in oklch, var(--accent) N%, transparent)`
percentages with the canonical `--accent-aXX` token scale.

Skips compounds whose second arg is NOT `transparent` (e.g. accent mixed
with another color, which is a real two-color blend, not a tint).
"""
import re
import sys
from pathlib import Path

# Round each input percentage to the closest scale stop.
SCALE = [8, 12, 20, 28, 45, 58, 85]


def closest_stop(pct: int) -> int:
    return min(SCALE, key=lambda s: abs(s - pct))


# Pattern: color-mix(in oklch, var(--accent[-...]?) N%, transparent)
# Whitespace tolerant; captures only the percentage and second arg.
PATTERN = re.compile(
    r"color-mix\(\s*in\s+oklch\s*,\s*"
    r"var\(--accent(?:-dynamic)?\)\s+(\d+)%\s*,\s*"
    r"transparent\s*\)",
    re.IGNORECASE,
)


def replace(text: str) -> tuple[str, int]:
    count = 0

    def sub(match: re.Match[str]) -> str:
        nonlocal count
        pct = int(match.group(1))
        stop = closest_stop(pct)
        count += 1
        return f"var(--accent-a{stop:02d})"

    new_text = PATTERN.sub(sub, text)
    return new_text, count


def main() -> int:
    base = Path("src/shared/styles/components")
    total = 0
    for f in sorted(base.glob("*.css")):
        before = f.read_text(encoding="utf-8")
        after, count = replace(before)
        if count:
            f.write_text(after, encoding="utf-8")
        print(f"{f.name}: {count} replacement(s)")
        total += count
    print(f"TOTAL: {total} replacement(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
