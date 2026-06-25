import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/operacao/vendas")({
  head: () => ({ meta: [{ title: "Vendas · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Vendas">
      <ProtoPage pageKey="mvendas" />
    </AppShell>
  );
}
