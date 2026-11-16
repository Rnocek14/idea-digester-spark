import { createFileRoute } from "@tanstack/react-router";
import FindYourCity from "@/pages/FindYourCity";

export const Route = createFileRoute("/cities")({
  component: FindYourCity,
});
