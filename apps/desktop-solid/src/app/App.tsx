import type { Component } from "solid-js";

/**
 * PR1 placeholder.
 *
 * Verifies the toolchain (Vite + vite-plugin-solid + UnoCSS + tsconfig)
 * boots end-to-end and previews the modernized design-token direction.
 * Real components arrive in PR3–PR5.
 */
const App: Component = () => {
  return (
    <main class="flex-1 grid place-items-center overflow-auto p-(7 6)">
      <section class="relative w-full max-w-220 grid gap-5 p-(7 6) rounded-xl border border-border-subtle shadow-elev-3 animate-rise overflow-hidden bg-[linear-gradient(180deg,var(--surface-2-soft),var(--surface-1-soft))] backdrop-blur-lg">
        <div class="chip-accent w-max">PR1 · Tooling Foundation</div>

        <h1 class="m-0 font-display text-3xl font-700 leading-tight tracking-tight">
          Audio Desktop <span class="text-gradient-accent">Solid</span>
        </h1>

        <p class="m-0 max-w-[60ch] text-md text-muted leading-snug">
          Vite + vite-plugin-solid + UnoCSS + TypeScript scaffold is live.
          Component port begins in PR2 (shared infra) → PR3 (leaves) → PR4/5
          (composites & pages).
        </p>

        <div class="grid grid-cols-4 gap-2">
          <div class="grid place-items-center h-16 rounded-md border border-border-subtle text-xs uppercase tracking-wide text-muted bg-surface-1 transition-transform duration-base ease-standard hover:-translate-y-0.5">
            surface-1
          </div>
          <div class="grid place-items-center h-16 rounded-md border border-border-subtle text-xs uppercase tracking-wide text-muted bg-surface-2 transition-transform duration-base ease-standard hover:-translate-y-0.5">
            surface-2
          </div>
          <div class="grid place-items-center h-16 rounded-md border border-border-subtle text-xs uppercase tracking-wide text-muted bg-surface-3 transition-transform duration-base ease-standard hover:-translate-y-0.5">
            surface-3
          </div>
          <div class="grid place-items-center h-16 rounded-md border-1 border-accent/50 text-xs uppercase tracking-wide text-accent-foreground bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] shadow-glow transition-transform duration-base ease-standard hover:-translate-y-0.5">
            accent
          </div>
        </div>

        <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <article class="glass-card p-4">
            <h3 class="m-0 mb-2 font-display text-md font-600 tracking-tight">Elevation</h3>
            <p class="m-0 text-sm text-muted leading-snug">
              Layered shadows with subtle inner highlight tokens (
              <code class="font-mono text-xs px-1.5 py-0.25 rounded-xs bg-surface-3 text-text-soft">
                --elev-1…4
              </code>
              ).
            </p>
          </article>

          <article class="glass-card p-4 shadow-elev-3 hover:shadow-elev-4">
            <h3 class="m-0 mb-2 font-display text-md font-600 tracking-tight">Motion</h3>
            <p class="m-0 text-sm text-muted leading-snug">
              Standard / emphasized easing presets, reduced-motion aware.
            </p>
          </article>

          <article class="glass-card p-4 border-accent/40 bg-[color-mix(in_oklch,var(--accent)_10%,var(--surface-2))]">
            <h3 class="m-0 mb-2 font-display text-md font-600 tracking-tight">Color</h3>
            <p class="m-0 text-sm text-muted leading-snug">
              OKLCH palette with surface ladder, semantic and accent scales.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
};

export default App;
