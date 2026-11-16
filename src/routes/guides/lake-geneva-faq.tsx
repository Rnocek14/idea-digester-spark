import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaFAQ from "@/pages/guides/LakeGenevaFAQ";

export const Route = createFileRoute("/guides/lake-geneva-faq")({
  component: LakeGenevaFAQ,
});
