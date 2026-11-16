import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaWinterfest from "@/pages/guides/LakeGenevaWinterfest";

export const Route = createFileRoute("/guides/lake-geneva-winterfest")({
  component: LakeGenevaWinterfest,
});
