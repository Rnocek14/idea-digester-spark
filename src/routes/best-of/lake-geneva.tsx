import { createFileRoute } from "@tanstack/react-router";
import BestOfLakeGeneva from "@/pages/best-of/BestOfLakeGeneva";

export const Route = createFileRoute("/best-of/lake-geneva")({
  component: BestOfLakeGeneva,
});
