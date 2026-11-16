import { createFileRoute } from "@tanstack/react-router";
import SellingLakeGeneva from "@/pages/SellingLakeGeneva";

export const Route = createFileRoute("/selling-lake-geneva")({
  component: SellingLakeGeneva,
});
