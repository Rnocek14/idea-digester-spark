import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Reports which story card is currently the topmost visible one on the page,
 * given an ordered list of story ids rendered as `#story-<id>` wrappers.
 * Also tracks which ones the reader has already scrolled past.
 */
export const useActiveStoryIndex = (ids: string[], enabled = true) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const visibleRef = useRef<Set<string>>(new Set());
  const key = ids.join("|");

  useEffect(() => {
    if (!enabled || ids.length === 0) return;
    visibleRef.current = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).id.replace(/^story-/, "");
          if (entry.isIntersecting) visibleRef.current.add(id);
          else visibleRef.current.delete(id);
        });
        const firstVisible = ids.findIndex((id) => visibleRef.current.has(id));
        if (firstVisible >= 0) {
          setActiveIndex(firstVisible);
          setReadIds((prev) => {
            const next = new Set(prev);
            ids.slice(0, firstVisible + 1).forEach((id) => next.add(id));
            return next;
          });
        }
      },
      { rootMargin: "-96px 0px -55% 0px", threshold: 0 },
    );

    const nodes = ids
      .map((id) => document.getElementById(`story-${id}`))
      .filter((el): el is HTMLElement => Boolean(el));
    nodes.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return useMemo(() => ({ activeIndex, readIds }), [activeIndex, readIds]);
};
