import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/venda/atender")({
  head: () => ({ meta: [{ title: "Atender agora · CoteCerto" }] }),
  component: () => (
    <AppShell title="Atender agora" crumbs="Venda">
      <PagePlaceholder />
    </AppShell>
  ),
});
