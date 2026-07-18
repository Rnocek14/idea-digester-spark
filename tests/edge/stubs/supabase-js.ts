// Test stub for esm.sh/npm @supabase/supabase-js imports inside edge functions.
// The harness installs globalThis.__createMockSupabase before importing a bundle.
export function createClient(url: string, key: string, opts?: unknown) {
  const factory = (globalThis as Record<string, unknown>).__createMockSupabase as
    | ((url: string, key: string, opts?: unknown) => unknown)
    | undefined;
  if (!factory) throw new Error("test harness: __createMockSupabase not installed");
  return factory(url, key, opts);
}
