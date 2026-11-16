import { createFileRoute } from "@tanstack/react-router";
import BusinessStories from "@/pages/BusinessStories";

export const Route = createFileRoute("/dashboard/business-stories")({
  component: BusinessStories,
});
