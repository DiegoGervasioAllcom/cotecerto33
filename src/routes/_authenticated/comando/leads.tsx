import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/comando/leads")({
  head: () => ({ meta: [{ title: "Leads · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Leads">
      <ProtoPage pageKey="mleads" />
    </AppShell>
  );
}
