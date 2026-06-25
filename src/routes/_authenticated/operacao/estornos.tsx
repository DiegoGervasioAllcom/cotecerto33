import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/operacao/estornos")({
  head: () => ({ meta: [{ title: "Estornos · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Estornos">
      <ProtoPage pageKey="mestorno" />
    </AppShell>
  );
}
