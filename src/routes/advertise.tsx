import { createFileRoute } from "@tanstack/react-router";
import Advertise from "@/pages/Advertise";

export const Route = createFileRoute("/advertise")({
  component: Advertise,
});
