import { createFileRoute } from "@tanstack/react-router";
import ImageTest from "@/pages/ImageTest";

export const Route = createFileRoute("/dashboard/image-test")({
  component: ImageTest,
});
