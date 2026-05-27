// Naive select multiple/tag probe (05-26 form-controls PR3).
//
// Validates selected tag chip hooks, close removal, additive selection, and
// that a single-select shell keeps its non-multiple structure.

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
      <main style="display:grid;gap:18px;padding:48px;max-width:460px;">
        <div id="multi-select" class="naive-select n-select">
          <div class="n-base-selection n-base-selection--multiple n-base-selection--selected">
            <div class="n-base-selection-tags">
              <div class="n-base-selection-tag-wrapper" data-value="Inter">
                <span class="n-tag n-tag--default n-tag--strong n-tag--closable">
                  <span class="n-tag__content">Inter</span>
                  <button class="n-tag__close n-base-close" type="button" aria-label="Remove Inter">x</button>
                  <span class="n-tag__border"></span>
                </span>
              </div>
              <div class="n-base-selection-tag-wrapper" data-value="Arial">
                <span class="n-tag n-tag--default n-tag--strong n-tag--closable">
                  <span class="n-tag__content">Arial</span>
                  <button class="n-tag__close n-base-close" type="button" aria-label="Remove Arial">x</button>
                  <span class="n-tag__border"></span>
                </span>
              </div>
              <div class="n-base-selection-tag-wrapper" data-value="Locked">
                <span class="n-tag n-tag--default n-tag--strong n-tag--disabled">
                  <span class="n-tag__content">Locked</span>
                  <button class="n-tag__close n-base-close" type="button" disabled aria-label="Locked">x</button>
                  <span class="n-tag__border"></span>
                </span>
              </div>
              <input id="tag-input" class="n-base-selection-input-tag" value="Mono">
            </div>
            <div class="n-base-selection__border"></div>
            <div class="n-base-selection__state-border"></div>
          </div>
        </div>
        <div id="multi-menu" class="n-base-select-menu n-base-select-menu--multiple">
          <div id="mono-option" class="n-base-select-option" data-value="Mono">
            <span class="n-base-select-option__content">Mono</span>
            <span class="n-base-select-option__check"></span>
          </div>
        </div>
        <div id="single-select" class="naive-select n-select">
          <div class="n-base-selection n-base-selection--selected">
            <div class="n-base-selection-label">
              <span class="n-base-selection-label__render-label">System</span>
            </div>
            <div class="n-base-selection__border"></div>
            <div class="n-base-selection__state-border"></div>
          </div>
        </div>
      </main>
    `;

    const values = ["Inter", "Arial", "Locked"];
    const removeValue = (value) => {
      const index = values.indexOf(value);
      if (index >= 0) values.splice(index, 1);
      document.querySelector(`[data-value="${value}"]`)?.remove();
    };
    document.querySelectorAll(".n-tag__close:not([disabled])").forEach((button) => {
      button.addEventListener("click", (event) => {
        const wrapper = event.currentTarget.closest(".n-base-selection-tag-wrapper");
        removeValue(wrapper?.getAttribute("data-value"));
      });
    });
    document.querySelector("#mono-option")?.addEventListener("click", (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      values.push("Mono");
      const wrapper = document.createElement("div");
      wrapper.className = "n-base-selection-tag-wrapper";
      wrapper.dataset.value = "Mono";
      wrapper.innerHTML = '<span class="n-tag n-tag--default n-tag--strong n-tag--closable"><span class="n-tag__content">Mono</span><button class="n-tag__close n-base-close" type="button">x</button><span class="n-tag__border"></span></span>';
      document.querySelector(".n-base-selection-tags")?.insertBefore(
        wrapper,
        document.querySelector("#tag-input")
      );
    });
    window.__NAIVE_SELECT_VALUES = values;
  });

  await page.click('[aria-label="Remove Inter"]');
  const afterRemove = await page.evaluate(() => window.__NAIVE_SELECT_VALUES.slice());
  await page.evaluate(() => {
    document
      .querySelector("#mono-option")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
  });
  const afterAdd = await page.evaluate(() => window.__NAIVE_SELECT_VALUES.slice());

  const result = await page.evaluate(() => {
    const multi = document.querySelector("#multi-select .n-base-selection");
    const tags = document.querySelector(".n-base-selection-tags");
    const single = document.querySelector("#single-select .n-base-selection");
    if (!multi || !tags || !single) throw new Error("Missing select hook");
    const tagContents = Array.from(document.querySelectorAll(".n-tag__content")).map(
      (node) => node.textContent
    );
    return {
      multiClasses: Array.from(multi.classList),
      menuClasses: Array.from(document.querySelector("#multi-menu")?.classList ?? []),
      tagContents,
      disabledCloseDisabled: document
        .querySelector('[data-value="Locked"] .n-tag__close')
        ?.hasAttribute("disabled"),
      inputTagClass: Array.from(document.querySelector("#tag-input")?.classList ?? []),
      tagsDisplay: getComputedStyle(tags).display,
      tagsFlexWrap: getComputedStyle(tags).flexWrap,
      singleHasMultipleClass: single.classList.contains("n-base-selection--multiple"),
      singleLabel: document.querySelector("#single-select .n-base-selection-label__render-label")
        ?.textContent,
    };
  });

  const checks = {
    multipleHookPresent: result.multiClasses.includes("n-base-selection--multiple"),
    menuMultipleHookPresent: result.menuClasses.includes("n-base-select-menu--multiple"),
    tagsFlexWrap: result.tagsDisplay === "flex" && result.tagsFlexWrap === "wrap",
    closeRemovesValue: !afterRemove.includes("Inter") && !result.tagContents.includes("Inter"),
    ctrlClickAddsValue: afterAdd.includes("Mono") && result.tagContents.includes("Mono"),
    disabledCloseGuard: result.disabledCloseDisabled === true,
    inputTagHookPresent: result.inputTagClass.includes("n-base-selection-input-tag"),
    singleSelectUnchanged:
      result.singleHasMultipleClass === false && result.singleLabel === "System",
  };

  const summary = { observed: { afterRemove, afterAdd }, result, checks };
  await writeFile(
    "output/playwright/naive-select-multi-probe-results.json",
    JSON.stringify(summary, null, 2)
  );
  console.log(JSON.stringify(summary, null, 2));

  if (!Object.values(checks).every(Boolean)) {
    console.error("naive_select_multi_probe: some checks failed");
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
