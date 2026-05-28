const TITLE_ATTRIBUTE = "title";
const TITLED_ELEMENT_SELECTOR = "[title]";
const SVG_TITLE_SELECTOR = "svg title";

function stripNativeTooltipFromElement(element: Element): void {
  if (element.hasAttribute(TITLE_ATTRIBUTE)) {
    element.removeAttribute(TITLE_ATTRIBUTE);
  }

  element
    .querySelectorAll<Element>(TITLED_ELEMENT_SELECTOR)
    .forEach((node) => node.removeAttribute(TITLE_ATTRIBUTE));

  element
    .querySelectorAll<SVGTitleElement>(SVG_TITLE_SELECTOR)
    .forEach((node) => node.remove());
}

function stripNativeTooltipFromNode(node: Node): void {
  if (node instanceof Element) {
    if (node.matches(SVG_TITLE_SELECTOR)) {
      node.remove();
      return;
    }
    stripNativeTooltipFromElement(node);
  }
}

export function installNativeBrowserBehaviorGuards(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault();
    },
    { capture: true }
  );

  const root = document.documentElement;
  stripNativeTooltipFromElement(root);

  if (typeof MutationObserver === "undefined") {
    return;
  }

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === "attributes") {
        stripNativeTooltipFromNode(record.target);
        return;
      }

      record.addedNodes.forEach(stripNativeTooltipFromNode);
    });
  });

  observer.observe(root, {
    attributes: true,
    attributeFilter: [TITLE_ATTRIBUTE],
    childList: true,
    subtree: true
  });
}
