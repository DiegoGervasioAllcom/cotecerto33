import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/operacao/premiacoes")({
  head: () => ({ meta: [{ title: "Premiações · CoteCerto" }] }),
  component: () => (
    <AppShell title="Premiações" crumbs="Operação">
      <PagePlaceholder />
    </AppShell>
  ),
});
