import { createFileRoute } from "@tanstack/react-router";
import CommunityLocalLove from "@/pages/CommunityLocalLove";

export const Route = createFileRoute("/community/local-love")({
  component: CommunityLocalLove,
});
