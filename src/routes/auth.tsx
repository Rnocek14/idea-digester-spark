import { createFileRoute } from "@tanstack/react-router";
import Auth from "@/pages/Auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in – Lake Geneva Brief" }, { name: "robots", content: "noindex" }] }),
  component: Auth,
});
