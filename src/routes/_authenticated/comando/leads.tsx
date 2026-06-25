import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/comando/leads")({
  head: () => ({ meta: [{ title: "Leads · CoteCerto" }] }),
  component: () => (
    <AppShell title="Leads" crumbs="Comando">
      <PagePlaceholder />
    </AppShell>
  ),
});
