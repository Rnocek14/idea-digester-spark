import { createFileRoute } from "@tanstack/react-router";
import Directory from "@/pages/Directory";

export const Route = createFileRoute("/dashboard/directory")({
  component: Directory,
});
