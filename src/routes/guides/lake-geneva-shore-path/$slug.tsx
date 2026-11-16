import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaShorePathStop from "@/pages/guides/LakeGenevaShorePathStop";

export const Route = createFileRoute("/guides/lake-geneva-shore-path/$slug")({
  component: LakeGenevaShorePathStop,
});
