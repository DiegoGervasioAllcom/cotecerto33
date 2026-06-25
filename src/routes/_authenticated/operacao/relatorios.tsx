import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/operacao/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Relatórios">
      <ProtoPage pageKey="mrel" />
    </AppShell>
  );
}
