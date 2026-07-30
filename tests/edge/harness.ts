// Test harness for edge functions bundled by build.mjs.
// Provides: a Deno shim (serve + env), a chainable mock Supabase client driven
// by a per-test resolver, and a URL-routed fetch mock.

export type QueryCall = {
  table: string;
  op: string;
  payload?: unknown;
  opts?: unknown;
  selectCols?: string;
  head?: boolean;
  countMode?: string;
  single?: boolean;
  filters: Array<{ m: string; args: unknown[] }>;
};

export type QueryResult = { data?: unknown; error?: { message: string } | null; count?: number | null };
export type Resolver = (q: QueryCall) => QueryResult | Promise<QueryResult> | undefined;

class MockBuilder implements PromiseLike<{ data: unknown; error: unknown; count: number | null }> {
  q: QueryCall;
  constructor(
    table: string,
    private resolver: Resolver,
    private calls: QueryCall[]
  ) {
    this.q = { table, op: "", filters: [] };
  }
  select(cols = "*", opts?: { head?: boolean; count?: string }) {
    if (!this.q.op) this.q.op = "select";
    this.q.selectCols = cols;
    if (opts?.head) this.q.head = true;
    if (opts?.count) this.q.countMode = opts.count;
    return this;
  }
  insert(p: unknown) { this.q.op = "insert"; this.q.payload = p; return this; }
  update(p: unknown) { this.q.op = "update"; this.q.payload = p; return this; }
  upsert(p: unknown, opts?: unknown) { this.q.op = "upsert"; this.q.payload = p; this.q.opts = opts; return this; }
  delete() { this.q.op = "delete"; return this; }
  maybeSingle() { this.q.single = true; return this; }
  single() { this.q.single = true; return this; }
  private f(m: string, ...args: unknown[]) { this.q.filters.push({ m, args }); return this; }
  eq(...a: unknown[]) { return this.f("eq", ...a); }
  neq(...a: unknown[]) { return this.f("neq", ...a); }
  gt(...a: unknown[]) { return this.f("gt", ...a); }
  gte(...a: unknown[]) { return this.f("gte", ...a); }
  lt(...a: unknown[]) { return this.f("lt", ...a); }
  lte(...a: unknown[]) { return this.f("lte", ...a); }
  in(...a: unknown[]) { return this.f("in", ...a); }
  is(...a: unknown[]) { return this.f("is", ...a); }
  not(...a: unknown[]) { return this.f("not", ...a); }
  ilike(...a: unknown[]) { return this.f("ilike", ...a); }
  order(...a: unknown[]) { return this.f("order", ...a); }
  limit(...a: unknown[]) { return this.f("limit", ...a); }
  then<T1, T2>(
    onfulfilled?: ((v: { data: unknown; error: unknown; count: number | null }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ) {
    this.calls.push(this.q);
    return Promise.resolve(this.resolver(this.q))
      .then((r) => ({
        data: r?.data !== undefined ? r.data : this.q.single ? null : [],
        error: r?.error ?? null,
        count: r?.count ?? null,
      }))
      .then(onfulfilled, onrejected);
  }
}

export function createMockSupabase(resolver: Resolver) {
  const calls: QueryCall[] = [];
  const client = {
    from(table: string) {
      return new MockBuilder(table, resolver, calls);
    },
    /**
     * Postgres function calls. Recorded as table `rpc:<name>` with op `rpc` and
     * the args as payload, so a resolver matches them the same way it matches
     * table queries.
     */
    async rpc(name: string, args?: unknown) {
      const q: QueryCall = { table: `rpc:${name}`, op: "rpc", payload: args, filters: [] };
      calls.push(q);
      const r = await resolver(q);
      return { data: r?.data !== undefined ? r.data : null, error: r?.error ?? null };
    },
    auth: {
      getUser: async (_token?: string) => {
        const user = (globalThis as Record<string, unknown>).__mockAuthUser ?? null;
        return { data: { user }, error: user ? null : { message: "invalid" } };
      },
    },
  };
  return { client, calls };
}

/** Find recorded calls by table and op. */
export function callsFor(calls: QueryCall[], table: string, op?: string): QueryCall[] {
  return calls.filter((c) => c.table === table && (!op || c.op === op));
}

export function installDeno(env: Record<string, string>) {
  let captured: ((req: Request) => Response | Promise<Response>) | null = null;
  (globalThis as Record<string, unknown>).Deno = {
    serve: (h: (req: Request) => Response | Promise<Response>) => {
      captured = h;
      return { finished: Promise.resolve() };
    },
    env: { get: (k: string) => env[k] },
  };
  return {
    handler: () => {
      if (!captured) throw new Error("Deno.serve was never called by the bundle");
      return captured;
    },
  };
}

export type FetchRoute = {
  match: (url: string, init?: RequestInit) => boolean;
  respond: (url: string, init?: RequestInit) => Response | Promise<Response>;
};

export function installFetchMock(routes: FetchRoute[]) {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    requests.push({ url, init });
    for (const r of routes) {
      if (r.match(url, init)) return await r.respond(url, init);
    }
    return new Response("not mocked: " + url, { status: 404 });
  }) as typeof fetch;
  return { requests };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function rssResponse(itemCount: number): Response {
  const items = Array.from({ length: itemCount }, (_, i) => `<item><title>Story ${i}</title></item>`).join("");
  return new Response(
    `<?xml version="1.0"?><rss version="2.0"><channel><title>Test Feed</title>${items}</channel></rss>`,
    { status: 200, headers: { "Content-Type": "application/rss+xml" } }
  );
}

/** Import a built bundle fresh (per test file) after installing shims. */
export async function importBundle(name: string): Promise<void> {
  await import(`./.build/${name}.mjs`);
}

export function makeRequest(
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Request {
  return new Request(`http://edge.test${path}`, {
    method: opts.method ?? "POST",
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

export const TEST_ENV = {
  SUPABASE_URL: "http://supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-key-123",
  SUPABASE_ANON_KEY: "anon-key-123",
};
