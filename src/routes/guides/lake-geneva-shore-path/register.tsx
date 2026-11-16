import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaShorePathRegister from "@/pages/guides/LakeGenevaShorePathRegister";

export const Route = createFileRoute("/guides/lake-geneva-shore-path/register")({
  component: LakeGenevaShorePathRegister,
});
