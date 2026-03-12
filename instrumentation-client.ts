function stripInjectedUserSelectStyle() {
  const cleanNode = (el: Element | null) => {
    if (!(el instanceof HTMLElement)) return;
    const raw = el.getAttribute("style");
    if (!raw) return;

    const normalized = raw.replace(/\s+/g, "").toLowerCase();
    if (normalized === "user-select:auto" || normalized === "user-select:auto;") {
      el.removeAttribute("style");
      return;
    }

    if (normalized.includes("user-select:auto")) {
      el.style.removeProperty("user-select");
      if (!el.getAttribute("style")) el.removeAttribute("style");
    }
  };

  const run = () => {
    cleanNode(document.documentElement);
    cleanNode(document.body);
    document.querySelectorAll("[style]").forEach((node) => cleanNode(node));
  };

  run();

  const observer = new MutationObserver(() => run());
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style"],
  });

  let rafCount = 0;
  const maxRaf = 180;

  const rafTick = () => {
    run();
    rafCount += 1;
    if (rafCount < maxRaf) {
      requestAnimationFrame(rafTick);
      return;
    }

    observer.disconnect();
  };

  requestAnimationFrame(rafTick);
  window.addEventListener("load", () => observer.disconnect(), { once: true });
}

stripInjectedUserSelectStyle();