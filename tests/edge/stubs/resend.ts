// Test stub for esm.sh/resend.
export class Resend {
  emails = {
    send: async (args: unknown) => {
      const mock = (globalThis as Record<string, unknown>).__resendSend as
        | ((args: unknown) => unknown)
        | undefined;
      if (mock) return await mock(args);
      return { data: { id: "mock-email" }, error: null };
    },
  };
  constructor(_apiKey: string) {}
}
