import { createFileRoute } from "@tanstack/react-router";
import ThingsToDoLakeGeneva from "@/pages/guides/ThingsToDoLakeGeneva";

export const Route = createFileRoute("/guides/things-to-do-lake-geneva")({
  component: ThingsToDoLakeGeneva,
});
