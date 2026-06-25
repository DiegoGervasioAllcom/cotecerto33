import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/operacao/mensagens")({
  head: () => ({ meta: [{ title: "Mensagens · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Mensagens">
      <ProtoPage pageKey="mmsgs" />
    </AppShell>
  );
}
