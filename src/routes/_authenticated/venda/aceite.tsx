import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/venda/aceite")({
  head: () => ({ meta: [{ title: "Aceite & transmissão · CoteCerto" }] }),
  component: () => (
    <AppShell title="Aceite & transmissão" crumbs="Venda">
      <PagePlaceholder />
    </AppShell>
  ),
});
