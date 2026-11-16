import { createFileRoute } from "@tanstack/react-router";
import YerkesObservatory from "@/pages/guides/YerkesObservatory";

export const Route = createFileRoute("/guides/yerkes-observatory")({
  component: YerkesObservatory,
});
