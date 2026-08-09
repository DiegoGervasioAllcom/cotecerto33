import { Icon } from "@/components/operacao/acessos/icon";

export type FullTeamMember = {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  equipe: string | null;
  produtos: number;
  comissao: number | null;
  leadsDia: number | null;
  desde: string;
  performanceStatus: string | null;
  personalizado: boolean;
  desligadoEm: string | null;
  supervisaoLabel: string;
};

function performanceChip(status: string | null) {
  if (status === "travado") return <span className="chip chip-alert">Travado</span>;
  if (status === "atencao") return <span className="chip chip-yellow">Atenção</span>;
  return <span className="chip chip-ok">Ativo</span>;
}

export function FullTeamTable({
  membros,
  onVer,
  onConfigurar,
  onExcluir,
}: {
  membros: FullTeamMember[];
  onVer: (membro: FullTeamMember) => void;
  onConfigurar: (membro: FullTeamMember) => void;
  onExcluir: (membro: FullTeamMember) => void;
}) {
  return (
    <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
      <table className="table-pipe">
        <thead>
          <tr>
            <th>Vendedor</th>
            <th>Equipe</th>
            <th>Supervisão</th>
            <th>Produtos</th>
            <th>Comissão</th>
            <th>Ano</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {membros.map((membro) => (
            <tr key={membro.id}>
              <td>
                <strong>{membro.nome}</strong>
                {membro.personalizado && (
                  <span className="chip chip-yellow" style={{ marginLeft: 6, fontSize: 10 }}>
                    personalizado
                  </span>
                )}
                <div className="small muted">{membro.cpf || membro.email}</div>
              </td>
              <td>{membro.equipe || "—"}</td>
              <td>
                <small className="muted">{membro.supervisaoLabel}</small>
              </td>
              <td>{membro.produtos} produto(s)</td>
              <td>
                <small className="muted">
                  {membro.comissao == null ? "modelo do time" : `${membro.comissao}%`}
                </small>
              </td>
              <td>{membro.desde}</td>
              <td>{performanceChip(membro.performanceStatus)}</td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <button className="btn btn-ghost btn-sm" onClick={() => onVer(membro)}>
                  <Icon id="eye" size={13} /> Ver
                </button>{" "}
                <button className="btn btn-ghost btn-sm" onClick={() => onConfigurar(membro)}>
                  <Icon id="settings" size={13} /> Configurar
                </button>{" "}
                <button className="btn btn-ghost btn-sm" onClick={() => onExcluir(membro)}>
                  <Icon id="trash" size={13} /> Excluir
                </button>
              </td>
            </tr>
          ))}
          {membros.length === 0 && (
            <tr>
              <td colSpan={8} className="muted small" style={{ padding: 16 }}>
                Ninguém no time ainda — convide ou cadastre direto.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
