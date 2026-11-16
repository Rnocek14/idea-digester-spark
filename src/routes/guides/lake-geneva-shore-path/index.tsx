import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaShorePath from "@/pages/guides/LakeGenevaShorePath";

export const Route = createFileRoute("/guides/lake-geneva-shore-path/")({
  component: LakeGenevaShorePath,
});
