import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaNightlife from "@/pages/LakeGenevaNightlife";

export const Route = createFileRoute("/nightlife")({
  component: LakeGenevaNightlife,
});
