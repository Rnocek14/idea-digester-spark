import { createFileRoute } from "@tanstack/react-router";
import ReaderFeedback from "@/pages/ReaderFeedback";

export const Route = createFileRoute("/dashboard/reader-feedback")({
  component: ReaderFeedback,
});
