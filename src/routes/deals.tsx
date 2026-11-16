import { createFileRoute } from "@tanstack/react-router";
import Deals from "@/pages/Deals";

export const Route = createFileRoute("/deals")({
  component: Deals,
});
