import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaSchools from "@/pages/guides/LakeGenevaSchools";

export const Route = createFileRoute("/guides/lake-geneva-schools")({
  component: LakeGenevaSchools,
});
