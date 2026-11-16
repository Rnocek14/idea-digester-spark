import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaPublicAccess from "@/pages/guides/LakeGenevaPublicAccess";

export const Route = createFileRoute("/guides/lake-geneva-public-access-guide")({
  component: LakeGenevaPublicAccess,
});
