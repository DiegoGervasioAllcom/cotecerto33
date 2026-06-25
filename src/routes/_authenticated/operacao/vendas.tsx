import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/operacao/vendas")({
  head: () => ({ meta: [{ title: "Vendas · CoteCerto" }] }),
  component: () => (
    <AppShell title="Vendas" crumbs="Operação">
      <PagePlaceholder />
    </AppShell>
  ),
});
