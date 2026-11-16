import { createFileRoute } from "@tanstack/react-router";
import Submit from "@/pages/Submit";

export const Route = createFileRoute("/submit")({
  component: Submit,
});
