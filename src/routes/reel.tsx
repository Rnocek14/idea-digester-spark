import { createFileRoute } from "@tanstack/react-router";
import StoryReel from "@/pages/StoryReel";

export const Route = createFileRoute("/reel")({
  component: StoryReel,
});
