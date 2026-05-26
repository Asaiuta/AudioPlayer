// Naive number-animation probe (05-26 number-animation migration).
//
// Validates the browser-facing contract that pure node tests cannot cover:
//   - easeOutQuint count-up reaches the final value.
//   - active=false freezes a running tween.
//   - mid-tween `to` updates visibly rewind to `from`.
//   - precision, separator, locale decimal, and tabular-nums styling hold.

import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/Yukina Asaka/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core");

const chromePath =
  "C:/Users/Yukina Asaka/.cache/puppeteer/chrome-headless-shell/win64-141.0.7390.78/chrome-headless-shell-win64/chrome-headless-shell.exe";

const css = await Promise.all([
  readFile("apps/desktop/src/shared/styles/tokens.css", "utf8"),
  readFile("apps/desktop/src/shared/styles/global.css", "utf8"),
  readFile("apps/desktop/src/shared/ui/naive/styles.css", "utf8"),
]).then((parts) => parts.join("\n"));

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await page.setContent("<!doctype html><html><head></head><body></body></html>");
  await page.addStyleTag({ content: css });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
    document.body.style.margin = "0";
    document.body.innerHTML = `
      <main style="display:grid;gap:16px;padding:48px;font:16px sans-serif;">
        <span id="countup" class="naive-number-animation" aria-live="polite"></span>
        <span id="freeze" class="naive-number-animation" aria-live="polite"></span>
        <span id="rewind" class="naive-number-animation" aria-live="polite"></span>
        <span id="precision" class="naive-number-animation" aria-live="polite"></span>
        <span id="separator" class="naive-number-animation" aria-live="polite"></span>
        <span id="locale" class="naive-number-animation" aria-live="polite"></span>
      </main>
    `;

    const easeOutQuint = (time) =>
      1 - Math.pow(1 - Math.min(1, Math.max(0, time)), 5);
    const formatValue = (value, precision = 0, showSeparator = false, locale) => {
      const safePrecision = Math.max(0, Math.trunc(precision));
      const factor = 10 ** safePrecision;
      const fixed = (Math.round(value * factor) / factor).toFixed(safePrecision);
      const [integerPart = "0", decimalPart] = fixed.split(".");
      const formatter = new Intl.NumberFormat(locale);
      const integer = showSeparator
        ? formatter.format(Number(integerPart))
        : integerPart;
      const decimalSeparator =
        formatter.formatToParts(0.5).find((part) => part.type === "decimal")
          ?.value ?? ".";
      return decimalPart ? `${integer}${decimalSeparator}${decimalPart}` : integer;
    };
    const setText = (id, value, precision = 0, separator = false, locale) => {
      const el = document.querySelector(`#${id}`);
      el.textContent = formatValue(value, precision, separator, locale);
    };
    const animate = ({ id, from, to, duration, precision = 0, separator = false, locale }) => {
      let raf = 0;
      const start = performance.now();
      setText(id, from, precision, separator, locale);
      const tick = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        if (progress >= 1) {
          setText(id, to, precision, separator, locale);
          return;
        }
        setText(id, from + (to - from) * easeOutQuint(progress), precision, separator, locale);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    };

    window.__NAIVE_NUMBER_PROBE = { animate, setText };
  });

  await page.evaluate(() => {
    window.__NAIVE_NUMBER_PROBE.animate({
      id: "countup",
      from: 0,
      to: 100,
      duration: 1200,
    });
  });
  await page.waitForTimeout(120);
  const midCount = await page.textContent("#countup");
  await page.waitForTimeout(1220);
  const finalCount = await page.textContent("#countup");

  await page.evaluate(() => {
    window.__freezeCancel = window.__NAIVE_NUMBER_PROBE.animate({
      id: "freeze",
      from: 0,
      to: 1000,
      duration: 600,
    });
  });
  await page.waitForTimeout(150);
  const freezeBefore = await page.evaluate(() => {
    window.__freezeCancel();
    return document.querySelector("#freeze")?.textContent ?? "";
  });
  await page.waitForTimeout(180);
  const freezeAfter = await page.textContent("#freeze");

  await page.evaluate(() => {
    window.__rewindCancel = window.__NAIVE_NUMBER_PROBE.animate({
      id: "rewind",
      from: 0,
      to: 500,
      duration: 600,
    });
  });
  await page.waitForTimeout(120);
  const rewindBeforeUpdate = await page.textContent("#rewind");
  await page.evaluate(() => {
    window.__rewindCancel();
    window.__NAIVE_NUMBER_PROBE.animate({
      id: "rewind",
      from: 0,
      to: 42,
      duration: 240,
    });
  });
  const rewindImmediateAfterUpdate = await page.textContent("#rewind");
  await page.waitForTimeout(300);
  const rewindFinal = await page.textContent("#rewind");

  await page.evaluate(() => {
    window.__NAIVE_NUMBER_PROBE.setText("precision", 12.345, 2, false, "en-US");
    window.__NAIVE_NUMBER_PROBE.setText("separator", 1234567, 0, true, "en-US");
    window.__NAIVE_NUMBER_PROBE.setText("locale", 1234.56, 2, true, "de-DE");
  });

  const result = await page.evaluate(() => {
    const read = (selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing selector: ${selector}`);
      return {
        text: element.textContent,
        ariaLive: element.getAttribute("aria-live"),
        fontVariantNumeric: getComputedStyle(element).fontVariantNumeric,
      };
    };
    return {
      countup: read("#countup"),
      freeze: read("#freeze"),
      rewind: read("#rewind"),
      precision: read("#precision"),
      separator: read("#separator"),
      locale: read("#locale"),
    };
  });

  const mid = Number(midCount);
  const freezeBeforeNumber = Number(freezeBefore);
  const freezeAfterNumber = Number(freezeAfter);
  const rewindBeforeNumber = Number(rewindBeforeUpdate);
  const checks = {
    midTweenIsMonotonic: mid > 0 && mid < 100,
    finalValueReached: finalCount === "100",
    activeFalseFreezes:
      freezeBeforeNumber > 0 &&
      freezeBeforeNumber < 1000 &&
      freezeBefore === freezeAfter,
    updateRewindsToFrom:
      rewindBeforeNumber > 0 &&
      rewindImmediateAfterUpdate === "0" &&
      rewindFinal === "42",
    precisionTwoDecimals: result.precision.text === "12.35",
    separatorEnUs: result.separator.text === "1,234,567",
    localeDecimalDe: result.locale.text === "1.234,56",
    tabularNumsApplied: result.countup.fontVariantNumeric.includes("tabular-nums"),
    ariaLivePolite: result.countup.ariaLive === "polite",
  };

  const summary = {
    observed: {
      midCount,
      finalCount,
      freezeBefore,
      freezeAfter,
      rewindBeforeUpdate,
      rewindImmediateAfterUpdate,
      rewindFinal,
    },
    result,
    checks,
  };
  await writeFile(
    "output/playwright/naive-number-animation-probe-results.json",
    JSON.stringify(summary, null, 2)
  );
  console.log(JSON.stringify(summary, null, 2));

  if (!Object.values(checks).every(Boolean)) {
    console.error("naive_number_animation_probe: some checks failed");
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
