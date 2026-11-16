import { createFileRoute } from "@tanstack/react-router";
import GuidesIndex from "@/pages/guides/GuidesIndex";

export const Route = createFileRoute("/guides/")({
  component: GuidesIndex,
});
