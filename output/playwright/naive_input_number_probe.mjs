// Naive input-number probe (05-26 form-controls PR2).
//
// Validates NaiveUI class hooks plus the facade-owned numeric behavior:
// clamp, precision display, no grouping, clear button, and hold-to-repeat.

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
      <main style="display:grid;gap:18px;padding:48px;max-width:360px;">
        <div id="number" class="naive-input-number n-input-number">
          <div class="n-input n-input--focus">
            <div class="n-input-wrapper">
              <div class="n-input__prefix n-input-number-prefix">ms</div>
              <div class="n-input__input">
                <input id="number-input" class="n-input__input-el" inputmode="decimal" value="5">
              </div>
              <div class="n-input__suffix n-input-number-suffix">
                <button id="clear" class="n-input__suffix-icon n-input-number-clear" type="button">clear</button>
                <div class="n-input-number-button-group">
                  <button id="plus" class="n-input-number-button n-input-number-button--plus" type="button">+</button>
                  <button id="minus" class="n-input-number-button n-input-number-button--minus" type="button">-</button>
                </div>
              </div>
            </div>
            <div class="n-input__border"></div>
            <div class="n-input__state-border"></div>
          </div>
        </div>
        <input id="precision" value="">
        <input id="grouping" value="">
      </main>
    `;

    const input = document.querySelector("#number-input");
    const min = 0;
    const max = 10;
    const step = 1;
    let holdDelay = 0;
    let holdInterval = 0;
    const parse = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const format = (value, precision) =>
      value == null ? "" : precision == null ? String(value) : value.toFixed(precision);
    const clamp = (value) => Math.min(max, Math.max(min, value));
    const setValue = (value) => {
      input.value = value == null ? "" : String(clamp(value));
    };
    const nudge = (direction) => {
      const current = parse(input.value) ?? 0;
      setValue(current + direction * step);
    };
    const clearHold = () => {
      clearTimeout(holdDelay);
      clearInterval(holdInterval);
      holdDelay = 0;
      holdInterval = 0;
    };
    const startHold = (direction) => {
      nudge(direction);
      clearHold();
      holdDelay = window.setTimeout(() => {
        holdInterval = window.setInterval(() => nudge(direction), 100);
      }, 800);
    };
    document.querySelector("#plus")?.addEventListener("pointerdown", () => startHold(1));
    document.querySelector("#minus")?.addEventListener("pointerdown", () => startHold(-1));
    ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
      document.querySelector("#plus")?.addEventListener(eventName, clearHold);
      document.querySelector("#minus")?.addEventListener(eventName, clearHold);
    });
    document.querySelector("#clear")?.addEventListener("click", () => setValue(null));
    document.querySelector("#precision").value = format(12.8, 0);
    document.querySelector("#grouping").value = format(1234567, undefined);
  });

  await page.dispatchEvent("#plus", "pointerdown");
  const afterPlus = await page.locator("#number-input").inputValue();
  await page.waitForTimeout(930);
  await page.dispatchEvent("#plus", "pointerup");
  const afterHold = await page.locator("#number-input").inputValue();
  await page.dispatchEvent("#minus", "pointerdown");
  await page.dispatchEvent("#minus", "pointerup");
  const afterMinus = await page.locator("#number-input").inputValue();
  await page.click("#clear");
  const afterClear = await page.locator("#number-input").inputValue();

  const result = await page.evaluate(() => {
    const root = document.querySelector("#number");
    const suffix = document.querySelector(".n-input-number-suffix");
    const plus = document.querySelector("#plus");
    const minus = document.querySelector("#minus");
    const group = document.querySelector(".n-input-number-button-group");
    if (!root || !suffix || !plus || !minus || !group) {
      throw new Error("Missing input-number class hook");
    }
    return {
      rootClasses: Array.from(root.classList),
      plusClasses: Array.from(plus.classList),
      minusClasses: Array.from(minus.classList),
      suffixClasses: Array.from(suffix.classList),
      groupDisplay: getComputedStyle(group).display,
      precision: document.querySelector("#precision")?.value,
      grouping: document.querySelector("#grouping")?.value,
    };
  });

  const checks = {
    rootHookPresent: result.rootClasses.includes("n-input-number"),
    suffixHookPresent: result.suffixClasses.includes("n-input-number-suffix"),
    buttonHooksPresent:
      result.plusClasses.includes("n-input-number-button--plus") &&
      result.minusClasses.includes("n-input-number-button--minus"),
    plusIncrements: afterPlus === "6",
    holdRepeats: Number(afterHold) > Number(afterPlus),
    minusDecrements: Number(afterMinus) === Number(afterHold) - 1,
    clearSetsEmpty: afterClear === "",
    precisionZeroInteger: result.precision === "13",
    noGrouping: result.grouping === "1234567",
  };

  const summary = {
    observed: { afterPlus, afterHold, afterMinus, afterClear },
    result,
    checks,
  };
  await writeFile(
    "output/playwright/naive-input-number-probe-results.json",
    JSON.stringify(summary, null, 2)
  );
  console.log(JSON.stringify(summary, null, 2));

  if (!Object.values(checks).every(Boolean)) {
    console.error("naive_input_number_probe: some checks failed");
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
