import { createFileRoute } from "@tanstack/react-router";
import MovingToLakeGeneva from "@/pages/guides/MovingToLakeGeneva";

export const Route = createFileRoute("/guides/moving-to-lake-geneva")({
  component: MovingToLakeGeneva,
});
