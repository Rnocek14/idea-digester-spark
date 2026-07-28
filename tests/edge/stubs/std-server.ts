// Test stub for deno.land/std http/server `serve` — delegates to the Deno shim.
export function serve(handler: (req: Request) => Response | Promise<Response>) {
  return (globalThis as { Deno?: { serve: (h: unknown) => unknown } }).Deno!.serve(handler);
}
