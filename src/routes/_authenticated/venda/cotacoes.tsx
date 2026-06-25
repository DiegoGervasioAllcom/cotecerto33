import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/venda/cotacoes")({
  head: () => ({ meta: [{ title: "Cotações · CoteCerto" }] }),
  component: () => (
    <AppShell title="Cotações" crumbs="Venda">
      <PagePlaceholder />
    </AppShell>
  ),
});
