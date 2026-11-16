import { createFileRoute } from "@tanstack/react-router";
import Sources from "@/pages/Sources";

export const Route = createFileRoute("/dashboard/sources")({
  component: Sources,
});
