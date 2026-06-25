import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/venda/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline · CoteCerto" }] }),
  component: () => (
    <AppShell title="Pipeline" crumbs="Venda">
      <PagePlaceholder />
    </AppShell>
  ),
});
