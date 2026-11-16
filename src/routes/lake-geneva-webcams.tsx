import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaWebcams from "@/pages/guides/LakeGenevaWebcams";

export const Route = createFileRoute("/lake-geneva-webcams")({
  component: LakeGenevaWebcams,
});
