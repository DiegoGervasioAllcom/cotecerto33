import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/venda/propostas")({
  head: () => ({ meta: [{ title: "Propostas · CoteCerto" }] }),
  component: () => (
    <AppShell title="Propostas" crumbs="Venda">
      <PagePlaceholder />
    </AppShell>
  ),
});
