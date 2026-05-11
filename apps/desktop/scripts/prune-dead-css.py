#!/usr/bin/env python3
"""Remove dead CSS classes from components/*.css.

For each rule whose selector list is entirely dead, drop the rule.
For mixed groups, just drop the dead selectors from the comma-list.
Recurses into @layer / @media blocks.
"""
import re
import sys
from pathlib import Path

DEAD = set("""
daily-songs-card--daily
eq-indicator
eq-indicator-bar
full-player-close
full-player-menu-button
history-chip
history-chip-default
history-chip-pause
history-chip-play
history-chip-seek
history-chip-stop
history-detail
history-list
history-meta
history-path
login-modal-feedback-error
login-modal-feedback-neutral
login-modal-feedback-success
media-list-truncated
modal-card-size-lg
modal-card-size-md
modal-card-size-sm
online-discover-filter-chip
online-discover-filter-row
online-discover-history-chip
online-discover-history-label
online-discover-history-list
online-discover-history-row
online-discover-search-bar
online-discover-search-panel
online-discover-search-tabs
online-discover-split
online-discover-stack-head
online-discover-view-head
online-hero
online-hero-actions
online-hero-chip
online-hero-chip-group
online-hero-copy
online-hero-eyebrow
online-hero-history
online-hero-history-chip
online-hero-history-label
online-hero-history-list
online-recommend-search-callout
online-recommend-search-copy
online-result-panel-playlists
online-search-form
player-realtime-chip
player-realtime-dot
player-status-rail
player-volume-inline
sidebar-section--created
sidebar-section--mine
top-nav-account-subtitle
volume-icon
""".strip().split())

STATS = {"rules_removed": 0, "selectors_pruned": 0}


def selector_uses_only_dead(selector: str) -> bool:
    """A selector is dead if any compound selector references a dead class.

    Reasoning: if `.dead-class` never appears in the DOM, then any compound
    that mentions it (e.g. `.dead-class.is-active`, `.dead-class .child`,
    `.live-parent .dead-class`) never matches, so the whole rule is dead.
    """
    classes = re.findall(r"\.([a-zA-Z0-9_-]+)", selector)
    if not classes:
        return False
    return any(cls in DEAD for cls in classes)


def find_matching_brace(src: str, open_pos: int) -> int:
    """Given position of `{`, return position one past the matching `}`."""
    depth = 1
    j = open_pos + 1
    n = len(src)
    while j < n and depth > 0:
        ch = src[j]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        j += 1
    return j


def process_block(src: str) -> str:
    """Process a CSS block (the inside of @layer/@media or the whole file).

    Walks top-level rules/at-rules in this block, processes each."""
    out: list[str] = []
    i = 0
    n = len(src)
    while i < n:
        brace = src.find("{", i)
        if brace == -1:
            out.append(src[i:])
            break

        # Find selector start: previous `;` or `}` or start of region.
        back = max(src.rfind("}", 0, brace), src.rfind(";", 0, brace), -1)
        sel_start = back + 1
        if sel_start < i:
            sel_start = i
        selector_raw = src[sel_start:brace]
        end = find_matching_brace(src, brace)
        body_with_braces = src[brace:end]
        inner = body_with_braces[1:-1]

        sel_stripped = selector_raw.strip()

        # Preserve any whitespace between i and sel_start (it's outside selectors).
        out.append(src[i:sel_start])

        if sel_stripped.startswith("@"):
            # At-rule. If it has a block body that contains nested rules
            # (@layer / @media / @supports), recurse into the inner.
            # Otherwise (e.g., @font-face) leave inner alone.
            recurse_prefixes = ("@layer", "@media", "@supports", "@container")
            if any(sel_stripped.startswith(p) for p in recurse_prefixes):
                new_inner = process_block(inner)
                out.append(selector_raw)
                out.append("{")
                out.append(new_inner)
                out.append("}")
            else:
                out.append(selector_raw)
                out.append(body_with_braces)
            i = end
            continue

        # Normal selector rule. Split on top-level commas.
        selectors = [s.strip() for s in selector_raw.split(",")]
        kept = [s for s in selectors if not selector_uses_only_dead(s)]

        prefix_match = re.match(r"^(\s*)", selector_raw)
        indent = prefix_match.group(1) if prefix_match else ""

        if not kept:
            # Drop the rule entirely. Also collapse one trailing newline
            # (so we don't leave a stray blank line).
            STATS["rules_removed"] += 1
            k = end
            if k < n and src[k] == "\n":
                k += 1
            # Also drop the leading-whitespace we already emitted? It was
            # emitted as src[i:sel_start]. If that's only whitespace ending
            # with a newline, we should keep just one blank line between
            # neighbours. Simpler: pop the trailing whitespace we just appended.
            if out and out[-1].strip() == "":
                out.pop()
            i = k
            continue

        if len(kept) != len(selectors):
            STATS["selectors_pruned"] += (len(selectors) - len(kept))
            new_selector_block = (",\n" + indent).join(kept)
            new_selector_block = indent + new_selector_block + " "
            out.append(new_selector_block)
            out.append(body_with_braces)
            i = end
            continue

        # Unchanged rule.
        out.append(selector_raw)
        out.append(body_with_braces)
        i = end

    return "".join(out)


def main() -> int:
    base = Path("src/shared/styles/components")
    total_removed = 0
    total_pruned = 0
    for f in sorted(base.glob("*.css")):
        STATS["rules_removed"] = 0
        STATS["selectors_pruned"] = 0
        before = f.read_text(encoding="utf-8")
        before_lines = len(before.splitlines())
        after = process_block(before)
        after_lines = len(after.splitlines())
        delta = after_lines - before_lines
        f.write_text(after, encoding="utf-8")
        print(
            f"{f.name}: removed {STATS['rules_removed']} rule(s), "
            f"pruned {STATS['selectors_pruned']} selector(s), {delta:+d} lines"
        )
        total_removed += STATS["rules_removed"]
        total_pruned += STATS["selectors_pruned"]
    print(f"TOTAL: removed {total_removed} rule(s), pruned {total_pruned} selector(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
