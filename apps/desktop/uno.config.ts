import {
  defineConfig,
  presetUno,
  presetTypography,
  transformerDirectives,
  transformerVariantGroup
} from "unocss";

/**
 * UnoCSS configuration for the Solid app.
 *
 * Theme values intentionally re-use the CSS custom properties declared in
 * `src/shared/styles/tokens.css` so that:
 *   - utility classes (e.g. `bg-surface-2`, `shadow-elev-3`)
 *   - and raw CSS files (when needed for canvas-driven visuals or scoped
 *     module styles)
 * draw from a single design-token source. Spacing scale matches the
 * existing `--space-1…9` tokens (overrides the Tailwind default).
 */
export default defineConfig({
  presets: [presetUno(), presetTypography()],
  transformers: [transformerVariantGroup(), transformerDirectives()],
  theme: {
    colors: {
      bg: "var(--bg)",
      surface: {
        DEFAULT: "var(--surface-1)",
        1: "var(--surface-1)",
        2: "var(--surface-2)",
        3: "var(--surface-3)",
        4: "var(--surface-4)"
      },
      border: {
        DEFAULT: "var(--border)",
        subtle: "var(--border-subtle)",
        strong: "var(--border-strong)"
      },
      text: {
        DEFAULT: "var(--text)",
        soft: "var(--text-soft)"
      },
      muted: {
        DEFAULT: "var(--muted)",
        soft: "var(--muted-soft)"
      },
      accent: {
        DEFAULT: "var(--accent)",
        strong: "var(--accent-strong)",
        soft: "var(--accent-soft)",
        foreground: "var(--accent-foreground)"
      },
      success: "var(--success)",
      warning: "var(--warning)",
      danger: "var(--danger)",
      info: "var(--info)"
    },
    spacing: {
      0: "var(--space-0)",
      1: "var(--space-1)",
      2: "var(--space-2)",
      3: "var(--space-3)",
      4: "var(--space-4)",
      5: "var(--space-5)",
      6: "var(--space-6)",
      7: "var(--space-7)",
      8: "var(--space-8)",
      9: "var(--space-9)"
    },
    borderRadius: {
      xs: "var(--radius-xs)",
      sm: "var(--radius-sm)",
      md: "var(--radius-md)",
      lg: "var(--radius-lg)",
      xl: "var(--radius-xl)",
      pill: "var(--radius-pill)",
      track: "var(--radius-track)",
      button: "var(--radius-button)",
      input: "var(--radius-input)",
      card: "var(--radius-card)",
      "card-prominent": "var(--radius-card-prominent)",
      "icon-btn": "var(--radius-icon-btn)"
    },
    boxShadow: {
      "elev-1": "var(--elev-1)",
      "elev-2": "var(--elev-2)",
      "elev-3": "var(--elev-3)",
      "elev-4": "var(--elev-4)",
      glow: "var(--glow-accent)"
    },
    fontFamily: {
      sans: "var(--font-sans)",
      display: "var(--font-display)",
      mono: "var(--font-mono)"
    },
    fontSize: {
      xs: "var(--text-xs)",
      sm: "var(--text-sm)",
      base: "var(--text-base)",
      md: "var(--text-md)",
      lg: "var(--text-lg)",
      xl: "var(--text-xl)",
      "2xl": "var(--text-2xl)",
      "3xl": "var(--text-3xl)"
    },
    lineHeight: {
      tight: "var(--leading-tight)",
      snug: "var(--leading-snug)",
      normal: "var(--leading-normal)"
    },
    letterSpacing: {
      tight: "var(--tracking-tight)",
      normal: "var(--tracking-normal)",
      wide: "var(--tracking-wide)",
      wider: "var(--tracking-wider)"
    },
    duration: {
      fast: "var(--duration-fast)",
      base: "var(--duration-base)",
      slow: "var(--duration-slow)",
      xslow: "var(--duration-xslow)"
    },
    easing: {
      standard: "var(--ease-standard)",
      emphasized: "var(--ease-emphasized)",
      bounce: "var(--ease-bounce)"
    },
    zIndex: {
      base: "var(--z-base)",
      sticky: "var(--z-sticky)",
      popover: "var(--z-popover)",
      toast: "var(--z-toast)",
      "context-menu": "var(--z-context-menu)",
      modal: "var(--z-modal)"
    },
    animation: {
      keyframes: {
        rise:
          "{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}",
        "fade-in": "{from{opacity:0}to{opacity:1}}"
      },
      durations: {
        rise: "var(--duration-xslow)",
        "fade-in": "var(--duration-base)"
      },
      timingFns: {
        rise: "var(--ease-emphasized)",
        "fade-in": "var(--ease-standard)"
      },
      properties: {
        rise: { "animation-fill-mode": "both" },
        "fade-in": { "animation-fill-mode": "both" }
      }
    }
  },
  shortcuts: {
    "glass-panel":
      "rounded-xl border border-border-subtle bg-surface-2/70 shadow-elev-3 backdrop-blur-lg",
    "glass-card":
      "rounded-lg border border-border-subtle bg-surface-2/70 shadow-elev-1 transition-all duration-base ease-standard hover:-translate-y-0.5 hover:shadow-elev-2 hover:border-border",
    "chip-accent":
      "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-accent-strong bg-accent-soft border border-accent/35 rounded-pill"
  },
  preflights: [
    {
      // ensures gradient-text utilities work consistently
      getCSS: () => `
        .text-gradient-accent {
          background: linear-gradient(
            135deg,
            var(--accent-strong),
            color-mix(in oklch, var(--accent) 60%, var(--info) 40%)
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
      `
    }
  ],
  safelist: ["text-gradient-accent"]
});
