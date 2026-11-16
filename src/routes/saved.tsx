import { createFileRoute } from "@tanstack/react-router";
import SavedStories from "@/pages/SavedStories";

export const Route = createFileRoute("/saved")({
  component: SavedStories,
});
