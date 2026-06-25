import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/operacao/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Configurações">
      <ProtoPage pageKey="mconf" />
    </AppShell>
  );
}
