// Visão do Supervisor de Vendas em /operacao/acessos — só acompanha, não
// administra (protótipo: "você não cadastra nem desliga — acompanha o
// desempenho e aciona a Matriz"). Tabela simples e dedicada, sem os blocos
// MATRIZ·TIME INTERNO / EXTERNOS·REDE (esses são exclusivos de quem
// administra — matriz/coordenador via `podeAdministrarAcessos`).
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Icon } from "@/components/operacao/acessos/icon";
import { useTeamData, type MembroEquipe } from "@/components/operacao/acessos/full/use-team-data";
import { MasterMemberModal } from "@/components/operacao/acessos/full/master-member-modal";

const CHIP: Record<string, string> = {
  "Supervisor (Matriz)": "chip-slate",
  "Master franqueado": "chip-yellow",
  Franquia: "chip-info",
  "Vendedor CLT": "chip-outline",
  "Vendedor de franquia": "chip-outline",
};

export function SupervisorAcessosView() {
  const { profile } = useAuth();
  const { rows, loading, err } = useTeamData(profile, 0);
  const [ver, setVer] = useState<MembroEquipe | null>(null);
  const ativos = rows.filter((r) => !r.desligado_em);

  return (
    <>
      <div className="audit-note" style={{ marginBottom: 18, alignItems: "flex-start" }}>
        <span style={{ flex: "none", marginTop: 1 }}>
          <Icon id="lock" size={15} />
        </span>
        <span>
          <strong>Papel de supervisão:</strong> você não cadastra nem desliga — acompanha o
          desempenho e aciona a Matriz. Cadastros entram pelo Convite Supper; desligamentos, pela
          solicitação do responsável ou decisão da Matriz.
        </span>
      </div>

      {err && <div className="banner alert">{err}</div>}

      <div className="card">
        <div className="card-h">
          <h3>
            <Icon id="users" size={16} /> Vendedores
          </h3>
          <span className="muted small" style={{ fontWeight: 500 }}>
            {ativos.length}
          </span>
        </div>
        <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
          {loading ? (
            <div className="muted small" style={{ padding: 16 }}>
              Carregando…
            </div>
          ) : (
            <table className="table-pipe">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Equipe</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ativos.map((membro) => (
                  <tr key={membro.id}>
                    <td>
                      <strong>{membro.nome}</strong>
                      <div className="small muted">
                        <span className={`chip ${CHIP[membro.tipoLabel] ?? "chip-outline"}`}>
                          {membro.tipoLabel}
                        </span>
                      </div>
                    </td>
                    <td>{membro.equipe || "—"}</td>
                    <td>
                      <span className="chip chip-ok">Ativo</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setVer(membro)}>
                        <Icon id="eye" size={13} /> Ver
                      </button>
                    </td>
                  </tr>
                ))}
                {!ativos.length && (
                  <tr>
                    <td
                      colSpan={4}
                      className="muted small"
                      style={{ textAlign: "center", padding: 32 }}
                    >
                      Nenhum vendedor encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {ver && <MasterMemberModal membro={ver} onClose={() => setVer(null)} />}
    </>
  );
}
