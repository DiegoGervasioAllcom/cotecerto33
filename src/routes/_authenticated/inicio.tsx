import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Início · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Início">
      <ProtoPage pageKey="home" />
    </AppShell>
  );
}
