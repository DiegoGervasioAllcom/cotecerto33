import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/operacao/vendedores")({
  head: () => ({ meta: [{ title: "Vendedores · CoteCerto" }] }),
  component: () => (
    <AppShell title="Vendedores" crumbs="Operação">
      <PagePlaceholder />
    </AppShell>
  ),
});
