import { createFileRoute } from "@tanstack/react-router";
import RestaurantsLakeGeneva from "@/pages/best-of/RestaurantsLakeGeneva";

export const Route = createFileRoute("/best-of/restaurants-lake-geneva")({
  component: RestaurantsLakeGeneva,
});
