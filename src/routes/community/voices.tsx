import { createFileRoute } from "@tanstack/react-router";
import CommunityVoices from "@/pages/CommunityVoices";

export const Route = createFileRoute("/community/voices")({
  component: CommunityVoices,
});
