import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/m/")({
  beforeLoad: () => {
    throw redirect({ to: "/m/cotacoes", replace: true });
  },
});
