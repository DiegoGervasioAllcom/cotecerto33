import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/venda/mensagens-prontas")({
  head: () => ({ meta: [{ title: "Mensagens prontas · CoteCerto" }] }),
  component: () => (
    <AppShell title="Mensagens prontas" crumbs="Venda">
      <PagePlaceholder />
    </AppShell>
  ),
});
