import { createFileRoute } from "@tanstack/react-router";
import SocialQueue from "@/pages/SocialQueue";

export const Route = createFileRoute("/dashboard/social-queue")({
  component: SocialQueue,
});
