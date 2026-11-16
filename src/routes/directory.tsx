import { createFileRoute } from "@tanstack/react-router";
import PublicDirectory from "@/pages/PublicDirectory";

export const Route = createFileRoute("/directory")({
  component: PublicDirectory,
});
