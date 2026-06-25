import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/venda/novo-lead")({
  head: () => ({ meta: [{ title: "Novo lead · CoteCerto" }] }),
  component: () => (
    <AppShell title="Novo lead" crumbs="Venda">
      <PagePlaceholder />
    </AppShell>
  ),
});
