import { createFileRoute } from "@tanstack/react-router";
import LakeGenevaWeather from "@/pages/guides/LakeGenevaWeather";

export const Route = createFileRoute("/lake-geneva-weather")({
  component: LakeGenevaWeather,
});
