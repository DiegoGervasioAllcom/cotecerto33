import pages from "@/data/proto-pages.json";
import { ProtoIcons } from "./proto-icons";

type Key = keyof typeof pages;

export function ProtoPage({ pageKey }: { pageKey: Key }) {
  const html = (pages as Record<string, string>)[pageKey] || "";
  return (
    <>
      <ProtoIcons />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
