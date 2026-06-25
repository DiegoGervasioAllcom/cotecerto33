import spriteSvg from "@/styles/proto-icons.svg?raw";

export function ProtoIcons() {
  return <div aria-hidden="true" style={{ position: "absolute", width: 0, height: 0 }} dangerouslySetInnerHTML={{ __html: spriteSvg }} />;
}
