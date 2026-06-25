import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/operacao/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · CoteCerto" }] }),
  component: () => (
    <AppShell title="Configurações" crumbs="Operação">
      <PagePlaceholder />
    </AppShell>
  ),
});
