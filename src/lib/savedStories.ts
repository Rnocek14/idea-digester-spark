// Device-local saved stories. No account, no sync — the whole point is that a
// reader can keep something without being asked to sign up. Stored under the
// same anonymous-session philosophy as the rest of the site's engagement data.

export type SavedStory = {
  id: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  category: string | null;
  geoTier: number | null;
  path: string;
  savedAt: string;
};

const KEY = "lg_saved_stories";
const MAX = 200;

type Listener = (items: SavedStory[]) => void;
const listeners = new Set<Listener>();

function read(): SavedStory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedStory[]).filter((s) => s && s.id) : [];
  } catch {
    return [];
  }
}

function write(items: SavedStory[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* quota or private mode — saving is a nicety, never an error */
  }
  listeners.forEach((fn) => fn(items));
}

export function listSavedStories(): SavedStory[] {
  return read();
}

export function isStorySaved(id: string): boolean {
  return read().some((s) => s.id === id);
}

export function saveStory(story: Omit<SavedStory, "savedAt">): SavedStory[] {
  const items = read().filter((s) => s.id !== story.id);
  const next = [{ ...story, savedAt: new Date().toISOString() }, ...items];
  write(next);
  return next;
}

export function removeSavedStory(id: string): SavedStory[] {
  const next = read().filter((s) => s.id !== id);
  write(next);
  return next;
}

/** Returns true when the story ended up saved, false when it was removed. */
export function toggleSavedStory(story: Omit<SavedStory, "savedAt">): boolean {
  if (isStorySaved(story.id)) {
    removeSavedStory(story.id);
    return false;
  }
  saveStory(story);
  return true;
}

export function subscribeSavedStories(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
