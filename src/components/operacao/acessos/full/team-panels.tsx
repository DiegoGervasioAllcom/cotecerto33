import { Icon } from "@/components/operacao/acessos/icon";
import type { FullTeamMember } from "./full-team";
import type { MembroEquipe } from "./use-team-data";

const CHIP: Record<string, string> = {
  "Supervisor (Matriz)": "chip-slate",
  "Master franqueado": "chip-yellow",
  Franquia: "chip-info",
  "Vendedor CLT": "chip-outline",
  "Vendedor de franquia": "chip-outline",
};

export function GenericTeamTable({
  membros,
  onDesligar,
}: {
  membros: MembroEquipe[];
  onDesligar: (membro: MembroEquipe) => void;
}) {
  return (
    <table className="table-pipe">
      <thead>
        <tr>
          <th>Usuário</th>
          <th>Tipo</th>
          <th>Supervisão</th>
          <th>Status</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {membros.map((membro) => (
          <tr key={membro.id}>
            <td>
              <strong>{membro.nome}</strong>
              <div className="muted small">{membro.email}</div>
            </td>
            <td>
              <span className={`chip ${CHIP[membro.tipoLabel] ?? "chip-outline"}`}>
                {membro.tipoLabel}
              </span>
            </td>
            <td>
              <small className="muted">{membro.supervisaoLabel}</small>
            </td>
            <td>
              <span className="chip chip-ok">Ativo</span>
            </td>
            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              {(membro.role === "vendedor" || membro.role === "franqueado") && (
                <button className="btn btn-ghost btn-sm" onClick={() => onDesligar(membro)}>
                  <Icon id="trash" size={12} /> Solicitar desligamento
                </button>
              )}
            </td>
          </tr>
        ))}
        {!membros.length && (
          <tr>
            <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>
              Nenhum usuário encontrado.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function FullDisabledPanel({ membros }: { membros: FullTeamMember[] }) {
  return (
    <div className="card">
      <div className="card-h">
        <h3>
          <Icon id="alert-triangle" size={16} /> Desligamentos da franquia
        </h3>
        <span className="chip chip-alert">{membros.length} registro(s)</span>
      </div>
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe">
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>Equipe</th>
              <th>Supervisão</th>
              <th>Quando</th>
            </tr>
          </thead>
          <tbody>
            {membros.map((membro) => (
              <tr key={membro.id}>
                <td>
                  <strong>{membro.nome}</strong>
                  <div className="small muted">{membro.cpf || membro.email}</div>
                </td>
                <td>{membro.equipe || "—"}</td>
                <td>{membro.supervisaoLabel}</td>
                <td>
                  {membro.desligadoEm
                    ? new Date(membro.desligadoEm).toLocaleDateString("pt-BR")
                    : "—"}
                </td>
              </tr>
            ))}
            {!membros.length && (
              <tr>
                <td colSpan={4} className="muted small" style={{ padding: 16 }}>
                  Nenhum desligamento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="card-b">
        <div className="audit-note">
          <Icon id="lock" size={15} />
          <span>
            <strong>Reinclusão controlada:</strong> desligado só volta com aprovação da Matriz.
          </span>
        </div>
      </div>
    </div>
  );
}
