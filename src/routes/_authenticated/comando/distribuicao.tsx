import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/comando/distribuicao")({
  head: () => ({ meta: [{ title: "Distribuição · CoteCerto" }] }),
  component: () => (
    <AppShell title="Distribuição" crumbs="Comando">
      <PagePlaceholder />
    </AppShell>
  ),
});
