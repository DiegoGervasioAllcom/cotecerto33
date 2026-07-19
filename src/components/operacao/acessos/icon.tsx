// Ícone SVG local (via sprite `ProtoIcons`) usado pelas telas de Acessos.
export function Icon({ id, size = 14 }: { id: string; size?: number }) {
  return (
    <svg style={{ width: size, height: size, verticalAlign: "-2px" }}>
      <use href={`#i-${id}`} />
    </svg>
  );
}
