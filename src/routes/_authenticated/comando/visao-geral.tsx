import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/comando/visao-geral")({
  head: () => ({ meta: [{ title: "Visão geral · CoteCerto" }] }),
  component: () => (
    <AppShell title="Visão geral" crumbs="Comando">
      <PagePlaceholder />
    </AppShell>
  ),
});
