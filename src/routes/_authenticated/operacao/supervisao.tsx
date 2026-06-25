import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/operacao/supervisao")({
  head: () => ({ meta: [{ title: "Supervisão · CoteCerto" }] }),
  component: () => (
    <AppShell title="Supervisão" crumbs="Operação">
      <PagePlaceholder />
    </AppShell>
  ),
});
