import { createFileRoute } from "@tanstack/react-router";
import HistoryEntries from "@/pages/HistoryEntries";

export const Route = createFileRoute("/dashboard/history")({
  component: HistoryEntries,
});
