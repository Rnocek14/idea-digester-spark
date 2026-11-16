import { createFileRoute } from "@tanstack/react-router";
import CostOfLivingLakeGeneva from "@/pages/guides/CostOfLivingLakeGeneva";

export const Route = createFileRoute("/guides/cost-of-living-lake-geneva")({
  component: CostOfLivingLakeGeneva,
});
