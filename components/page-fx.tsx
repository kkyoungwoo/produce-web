"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const REVEAL_SELECTOR = "[data-reveal='up']";
const CLICKABLE_SELECTOR = "button, a, .card, [role='button'], [data-clickable='true']";

export default function PageFx() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.setAttribute("data-fx-ready", "1");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
    );

    const observeRevealNodes = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
      nodes.forEach((node) => {
        if (node.classList.contains("is-visible")) return;
        observer.observe(node);
      });
    };

    observeRevealNodes();

    const mutationObserver = new MutationObserver(() => observeRevealNodes());
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const onPointerDown = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest(CLICKABLE_SELECTOR) as HTMLElement | null;
      if (!target) return;

      target.animate(
        [
          { transform: "scale(1)", offset: 0 },
          { transform: "scale(0.985)", offset: 0.45 },
          { transform: "scale(1)", offset: 1 },
        ],
        { duration: 170, easing: "ease-out" },
      );
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [pathname]);

  return null;
}
