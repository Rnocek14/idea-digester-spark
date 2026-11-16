import { createFileRoute } from "@tanstack/react-router";
import StoryDetail from "@/pages/StoryDetail";

export const Route = createFileRoute("/stories/$idOrSlug")({
  component: StoryDetail,
});
