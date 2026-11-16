import { createFileRoute } from "@tanstack/react-router";
import WinterLakeGeneva from "@/pages/guides/WinterLakeGeneva";

export const Route = createFileRoute("/guides/things-to-do-lake-geneva-in-winter")({
  component: WinterLakeGeneva,
});
