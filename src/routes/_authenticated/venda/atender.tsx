import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/venda/atender")({
  head: () => ({ meta: [{ title: "Atender agora · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Atender agora">
      <ProtoPage pageKey="atender" />
    </AppShell>
  );
}
