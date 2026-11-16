import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/lake-geneva")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
