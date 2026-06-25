import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/operacao/comissoes")({
  head: () => ({ meta: [{ title: "Comissões · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Comissões">
      <ProtoPage pageKey="mcomm" />
    </AppShell>
  );
}
