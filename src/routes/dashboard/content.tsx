import { createFileRoute } from "@tanstack/react-router";
import ContentQueue from "@/pages/ContentQueue";

export const Route = createFileRoute("/dashboard/content")({
  component: ContentQueue,
});
