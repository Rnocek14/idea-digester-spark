import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaVsWilliamsBay from "@/pages/guides/LakeGenevaVsWilliamsBay";

export const Route = createFileRoute("/guides/lake-geneva-vs-williams-bay")({
  component: LakeGenevaVsWilliamsBay,
});
