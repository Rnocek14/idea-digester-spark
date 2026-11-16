import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaNeighborhoods from "@/pages/guides/LakeGenevaNeighborhoods";

export const Route = createFileRoute("/guides/lake-geneva-neighborhoods")({
  component: LakeGenevaNeighborhoods,
});
