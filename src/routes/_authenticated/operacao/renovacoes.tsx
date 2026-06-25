import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/operacao/renovacoes")({
  head: () => ({ meta: [{ title: "Renovações · CoteCerto" }] }),
  component: () => (
    <AppShell title="Renovações" crumbs="Operação">
      <PagePlaceholder />
    </AppShell>
  ),
});
