import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/operacao/comissoes")({
  head: () => ({ meta: [{ title: "Comissões · CoteCerto" }] }),
  component: () => (
    <AppShell title="Comissões" crumbs="Operação · Em formulação">
      <PagePlaceholder />
    </AppShell>
  ),
});
