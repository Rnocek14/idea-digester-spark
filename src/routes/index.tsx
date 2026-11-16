import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaV2 from "@/pages/LakeGenevaV2";

export const Route = createFileRoute("/")({
  component: LakeGenevaV2,
});
