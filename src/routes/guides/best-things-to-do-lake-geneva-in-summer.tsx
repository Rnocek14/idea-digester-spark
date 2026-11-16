import { createFileRoute } from "@tanstack/react-router";
import SummerLakeGeneva from "@/pages/guides/SummerLakeGeneva";

export const Route = createFileRoute("/guides/best-things-to-do-lake-geneva-in-summer")({
  component: SummerLakeGeneva,
});
