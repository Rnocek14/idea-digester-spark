import { createFileRoute } from "@tanstack/react-router";
import ThisWeekendLakeGeneva from "@/pages/guides/ThisWeekendLakeGeneva";

export const Route = createFileRoute("/guides/things-to-do-lake-geneva-this-weekend")({
  component: ThisWeekendLakeGeneva,
});
