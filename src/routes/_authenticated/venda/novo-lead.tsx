import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/venda/novo-lead")({
  head: () => ({ meta: [{ title: "Novo lead · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Novo lead">
      <ProtoPage pageKey="lead" />
    </AppShell>
  );
}
