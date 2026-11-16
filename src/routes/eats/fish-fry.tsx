import { createFileRoute } from "@tanstack/react-router";
import FishFryGuide from "@/pages/FishFryGuide";

export const Route = createFileRoute("/eats/fish-fry")({
  component: FishFryGuide,
});
