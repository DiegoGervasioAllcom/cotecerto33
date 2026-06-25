import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/venda/mensagens-prontas")({
  head: () => ({ meta: [{ title: "Mensagens prontas · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Mensagens prontas">
      <ProtoPage pageKey="msgs" />
    </AppShell>
  );
}
