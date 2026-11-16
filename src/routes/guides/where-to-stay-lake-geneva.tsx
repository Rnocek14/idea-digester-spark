import { createFileRoute } from "@tanstack/react-router";
import WhereToStayLakeGeneva from "@/pages/guides/WhereToStayLakeGeneva";

export const Route = createFileRoute("/guides/where-to-stay-lake-geneva")({
  component: WhereToStayLakeGeneva,
});
