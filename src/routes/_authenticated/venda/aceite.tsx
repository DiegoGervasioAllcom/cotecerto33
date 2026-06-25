import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/venda/aceite")({
  head: () => ({ meta: [{ title: "Aceite & transmissão · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Aceite & transmissão">
      <ProtoPage pageKey="aceite" />
    </AppShell>
  );
}
