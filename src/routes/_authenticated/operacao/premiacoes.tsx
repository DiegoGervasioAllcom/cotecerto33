import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/operacao/premiacoes")({
  head: () => ({ meta: [{ title: "Premiações · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Premiações">
      <ProtoPage pageKey="mprem" />
    </AppShell>
  );
}
