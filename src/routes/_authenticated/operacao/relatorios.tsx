import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/operacao/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · CoteCerto" }] }),
  component: () => (
    <AppShell title="Relatórios" crumbs="Operação">
      <PagePlaceholder />
    </AppShell>
  ),
});
