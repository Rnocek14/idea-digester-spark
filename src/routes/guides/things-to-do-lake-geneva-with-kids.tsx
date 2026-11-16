import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaWithKids from "@/pages/guides/LakeGenevaWithKids";

export const Route = createFileRoute("/guides/things-to-do-lake-geneva-with-kids")({
  component: LakeGenevaWithKids,
});
