import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/operacao/acessos")({
  head: () => ({ meta: [{ title: "Acessos e permissões · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Acessos e permissões">
      <ProtoPage pageKey="macessos" />
    </AppShell>
  );
}
