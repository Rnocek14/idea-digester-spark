import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaShorePathPassport from "@/pages/guides/LakeGenevaShorePathPassport";

export const Route = createFileRoute("/guides/lake-geneva-shore-path/passport")({
  component: LakeGenevaShorePathPassport,
});
