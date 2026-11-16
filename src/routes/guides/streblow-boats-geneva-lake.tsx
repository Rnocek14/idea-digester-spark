import { createFileRoute } from "@tanstack/react-router";
import StreblowBoats from "@/pages/guides/StreblowBoats";

export const Route = createFileRoute("/guides/streblow-boats-geneva-lake")({
  component: StreblowBoats,
});
