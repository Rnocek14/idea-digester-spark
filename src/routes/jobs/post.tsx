import { createFileRoute } from "@tanstack/react-router";
import PostJob from "@/pages/PostJob";

export const Route = createFileRoute("/jobs/post")({
  component: PostJob,
});
