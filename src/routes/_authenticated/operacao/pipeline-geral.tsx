import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PagePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/operacao/pipeline-geral")({
  head: () => ({ meta: [{ title: "Pipeline geral · CoteCerto" }] }),
  component: () => (
    <AppShell title="Pipeline geral" crumbs="Operação">
      <PagePlaceholder />
    </AppShell>
  ),
});
