import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/operacao/estornos")({
  head: () => ({ meta: [{ title: "Estornos · CoteCerto" }] }),
  component: () => (
    <AppShell title="Estornos" crumbs="Operação">
      <PagePlaceholder />
    </AppShell>
  ),
});
