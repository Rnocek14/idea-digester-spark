import { createFileRoute } from "@tanstack/react-router";
import BrunosLiquors from "@/pages/businesses/BrunosLiquors";

export const Route = createFileRoute("/businesses/brunos-liquors")({
  component: BrunosLiquors,
});
