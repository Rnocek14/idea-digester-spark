// Tiny URL slug helper. Lossy — used only for prettier URLs; the canonical
// route still resolves by id, so collisions don't matter.
export function slugify(input: string, max = 60): string {
  return (input || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export function storyPath(id: string, title?: string | null): string {
  const s = slugify(title || "");
  return s ? `/stories/${s}-${id}` : `/stories/${id}`;
}

// Extract the trailing UUID from a slug+id path segment.
// Works whether the caller passed just an id or "{slug}-{id}".
export function extractStoryId(param: string): string {
  const m = param.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return m ? m[0] : param;
}