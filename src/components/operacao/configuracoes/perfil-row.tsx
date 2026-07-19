// Linha de resumo por perfil (Matriz/Franqueado/Vendedor/Todos) no card
// "Perfis e usuários".
export function PerfilRow({
  title,
  desc,
  count,
  solid,
  onClick,
}: {
  title: string;
  desc: string;
  count: number;
  solid?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="crit-row" style={onClick ? { cursor: "pointer" } : undefined} onClick={onClick}>
      <div className="cr-body">
        <div className="cr-t">{title}</div>
        <div className="cr-d">{desc}</div>
      </div>
      <span className={`chip ${solid ? "chip-slate" : "chip-outline"}`}>
        {count} {count === 1 ? "usuário" : "usuários"}
      </span>
    </div>
  );
}
