import { createFileRoute } from "@tanstack/react-router";
import DebugFeed from "@/pages/DebugFeed";

export const Route = createFileRoute("/debug/feed")({
  component: DebugFeed,
});
