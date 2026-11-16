import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaMarketReport from "@/pages/guides/LakeGenevaMarketReport";

export const Route = createFileRoute("/market-report")({
  component: LakeGenevaMarketReport,
});
