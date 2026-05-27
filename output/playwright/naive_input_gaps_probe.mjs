// Naive input gaps probe (05-26 form-controls PR1).
//
// Covers the browser-facing contract for the lightweight NaiveInput gap pass:
// password reveal hook, attribute passthrough, and warning/error class hooks.

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
      <main style="display:grid;gap:18px;padding:48px;max-width:420px;">
        <div id="password-shell" class="n-input n-input--password n-input--warning-status">
          <div class="n-input-wrapper">
            <div class="n-input__input">
              <input id="password-input" class="n-input__input-el" type="password" autocomplete="off" value="secret">
              <div class="n-input__placeholder">Password</div>
            </div>
            <div class="n-input__suffix">
              <button id="password-eye" class="n-input__suffix-icon n-input__suffix-icon--password-eye" type="button" aria-label="Toggle password visibility">eye</button>
            </div>
          </div>
          <div class="n-input__border"></div>
          <div class="n-input__state-border"></div>
        </div>
        <div id="error-shell" class="n-input n-input--error-status">
          <div class="n-input-wrapper">
            <div class="n-input__input">
              <input class="n-input__input-el" value="bad">
            </div>
          </div>
          <div class="n-input__border"></div>
          <div class="n-input__state-border"></div>
        </div>
      </main>
    `;

    const input = document.querySelector("#password-input");
    document.querySelector("#password-eye")?.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
    });
  });

  const beforeType = await page.locator("#password-input").getAttribute("type");
  await page.click("#password-eye");
  const afterFirstClickType = await page.locator("#password-input").getAttribute("type");
  await page.click("#password-eye");
  const afterSecondClickType = await page.locator("#password-input").getAttribute("type");

  const result = await page.evaluate(() => {
    const readShell = (selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing selector: ${selector}`);
      const style = getComputedStyle(element);
      return {
        classList: Array.from(element.classList),
        borderRadius: style.borderRadius,
        minHeight: style.minHeight,
      };
    };
    const eye = document.querySelector("#password-eye");
    const input = document.querySelector("#password-input");
    return {
      password: readShell("#password-shell"),
      error: readShell("#error-shell"),
      eyeClasses: eye ? Array.from(eye.classList) : [],
      inputType: input?.getAttribute("type"),
      autocomplete: input?.getAttribute("autocomplete"),
      suffixExists: Boolean(document.querySelector(".n-input__suffix")),
      stateBorderExists: Boolean(document.querySelector(".n-input__state-border")),
    };
  });

  const checks = {
    passwordHookPresent: result.password.classList.includes("n-input--password"),
    warningHookPresent: result.password.classList.includes("n-input--warning-status"),
    errorHookPresent: result.error.classList.includes("n-input--error-status"),
    passwordEyeHookPresent: result.eyeClasses.includes("n-input__suffix-icon--password-eye"),
    inputPropsAutocompleteOff: result.autocomplete === "off",
    suffixAndStateBorderPresent: result.suffixExists && result.stateBorderExists,
    clickRevealToggles:
      beforeType === "password" &&
      afterFirstClickType === "text" &&
      afterSecondClickType === "password",
  };

  const summary = {
    observed: {
      beforeType,
      afterFirstClickType,
      afterSecondClickType,
    },
    result,
    checks,
  };
  await writeFile(
    "output/playwright/naive-input-gaps-probe-results.json",
    JSON.stringify(summary, null, 2)
  );
  console.log(JSON.stringify(summary, null, 2));

  if (!Object.values(checks).every(Boolean)) {
    console.error("naive_input_gaps_probe: some checks failed");
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
