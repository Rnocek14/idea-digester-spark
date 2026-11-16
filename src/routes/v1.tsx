import { createFileRoute } from "@tanstack/react-router";
import LakeGeneva from "@/pages/LakeGeneva";

export const Route = createFileRoute("/v1")({
  component: LakeGeneva,
});
