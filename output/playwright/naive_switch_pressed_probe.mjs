// Naive switch pressed/loading/value probe (05-26 form-controls PR4).
//
// Validates pressed class toggling, loading click blocking, Space key default
// prevention, .n-base-loading hook, and non-boolean checkedValue round trips.

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
      <main style="display:flex;gap:24px;padding:48px;align-items:center;">
        <div id="switch" class="naive-switch n-switch n-switch--round n-switch--rubber-band" role="switch" tabindex="0" aria-checked="false">
          <div class="n-switch__rail" aria-hidden="true">
            <div class="n-switch__button"></div>
          </div>
        </div>
        <div id="loading-switch" class="naive-switch n-switch n-switch--loading" role="switch" tabindex="0" aria-checked="false">
          <div class="n-switch__rail" aria-hidden="true">
            <div class="n-switch__button">
              <div class="n-base-loading"></div>
            </div>
          </div>
        </div>
      </main>
    `;

    const checkedValue = "enabled";
    const uncheckedValue = "disabled";
    let value = uncheckedValue;
    const emitted = [];
    const toggle = () => {
      value = value === checkedValue ? uncheckedValue : checkedValue;
      emitted.push(value);
      const active = value === checkedValue;
      const root = document.querySelector("#switch");
      root.classList.toggle("n-switch--active", active);
      root.setAttribute("aria-checked", String(active));
    };
    const root = document.querySelector("#switch");
    root.addEventListener("pointerdown", () => root.classList.add("n-switch--pressed"));
    ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
      root.addEventListener(eventName, () => root.classList.remove("n-switch--pressed"));
    });
    root.addEventListener("keydown", (event) => {
      if (event.key !== " ") return;
      event.preventDefault();
      root.classList.add("n-switch--pressed");
    });
    root.addEventListener("keyup", (event) => {
      if (event.key !== " ") return;
      event.preventDefault();
      root.classList.remove("n-switch--pressed");
      toggle();
    });
    root.addEventListener("click", toggle);
    document.querySelector("#loading-switch")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      emitted.push("blocked");
    });
    window.__NAIVE_SWITCH_PROBE = {
      emitted,
      get value() {
        return value;
      },
    };
  });

  await page.dispatchEvent("#switch", "pointerdown");
  const pressedDuringPointer = await page.locator("#switch").evaluate((node) =>
    node.classList.contains("n-switch--pressed")
  );
  await page.dispatchEvent("#switch", "pointerup");
  const pressedAfterPointer = await page.locator("#switch").evaluate((node) =>
    node.classList.contains("n-switch--pressed")
  );
  const keydownPrevented = await page.locator("#switch").evaluate((node) => {
    const event = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    node.dispatchEvent(event);
    return event.defaultPrevented;
  });
  await page.locator("#switch").evaluate((node) => {
    node.dispatchEvent(
      new KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true })
    );
  });
  const afterSpace = await page.evaluate(() => ({
    value: window.__NAIVE_SWITCH_PROBE.value,
    emitted: window.__NAIVE_SWITCH_PROBE.emitted.slice(),
  }));
  await page.click("#loading-switch");
  const afterLoadingClick = await page.evaluate(() => ({
    value: window.__NAIVE_SWITCH_PROBE.value,
    emitted: window.__NAIVE_SWITCH_PROBE.emitted.slice(),
  }));

  const result = await page.evaluate(() => {
    const root = document.querySelector("#switch");
    const loading = document.querySelector("#loading-switch");
    if (!root || !loading) throw new Error("Missing switch hook");
    return {
      rootClasses: Array.from(root.classList),
      loadingClasses: Array.from(loading.classList),
      loadingHookExists: Boolean(loading.querySelector(".n-base-loading")),
      rootAriaChecked: root.getAttribute("aria-checked"),
      loadingCursor: getComputedStyle(loading.querySelector(".n-switch__rail")).cursor,
    };
  });

  const checks = {
    pressedClassToggles: pressedDuringPointer === true && pressedAfterPointer === false,
    spaceKeyPreventsDefault: keydownPrevented === true,
    nonBooleanValueRoundTrip:
      afterSpace.value === "enabled" && afterSpace.emitted.includes("enabled"),
    loadingClickBlocked:
      afterLoadingClick.value === "enabled" &&
      afterLoadingClick.emitted[afterLoadingClick.emitted.length - 1] === "blocked",
    loadingHookPresent:
      result.loadingClasses.includes("n-switch--loading") && result.loadingHookExists,
    activeClassAfterToggle:
      result.rootAriaChecked === "true" && result.rootClasses.includes("n-switch--active"),
  };

  const summary = {
    observed: {
      pressedDuringPointer,
      pressedAfterPointer,
      keydownPrevented,
      afterSpace,
      afterLoadingClick,
    },
    result,
    checks,
  };
  await writeFile(
    "output/playwright/naive-switch-pressed-probe-results.json",
    JSON.stringify(summary, null, 2)
  );
  console.log(JSON.stringify(summary, null, 2));

  if (!Object.values(checks).every(Boolean)) {
    console.error("naive_switch_pressed_probe: some checks failed");
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
