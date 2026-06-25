import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/comando/visao-geral")({
  head: () => ({ meta: [{ title: "Visão geral · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Visão geral">
      <ProtoPage pageKey="mdash" />
    </AppShell>
  );
}
