import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/venda/extrato")({
  head: () => ({ meta: [{ title: "Extrato de vendas · CoteCerto" }] }),
  component: () => (
    <AppShell title="Extrato de vendas" crumbs="Venda">
      <PagePlaceholder />
    </AppShell>
  ),
});
