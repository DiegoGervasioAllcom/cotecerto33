import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/operacao/mensagens")({
  head: () => ({ meta: [{ title: "Mensagens · CoteCerto" }] }),
  component: () => (
    <AppShell title="Mensagens" crumbs="Operação">
      <PagePlaceholder />
    </AppShell>
  ),
});
