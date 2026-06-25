import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/operacao/renovacoes")({
  head: () => ({ meta: [{ title: "Renovações · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Renovações">
      <ProtoPage pageKey="mren" />
    </AppShell>
  );
}
