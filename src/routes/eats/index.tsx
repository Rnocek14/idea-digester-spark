import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaEats from "@/pages/LakeGenevaEats";

export const Route = createFileRoute("/eats/")({
  component: LakeGenevaEats,
});
