import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/operacao/acessos")({
  head: () => ({ meta: [{ title: "Acessos e permissões · CoteCerto" }] }),
  component: () => (
    <AppShell title="Acessos e permissões" crumbs="Operação">
      <PagePlaceholder />
    </AppShell>
  ),
});
