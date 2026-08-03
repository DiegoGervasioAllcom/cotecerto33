// V11 · C5 (Frente 3) — aba "Cadastros Rede" (`accRede()` do protótipo r40).
//
// Masters, franquias e vendedores da rede externa, unificados numa lista só —
// mesmo padrão de `cadastros-matriz-tab.tsx` (fetch em memória + filtros +
// tabela), mas para fora da Matriz. Diferente do protótipo, que hardcodeava
// "Franquia | Full"/"Franquia | Individual", aqui a modalidade vem de
// `modelos_franquia.modalidade` (dado real, ver H2 e G2.1).
//
// "Excluir" chama `excluir_cadastro_rede` (C6) — RPC dedicada que barra
// exclusão de Master com franquia ativa vinculada, ou franquia com vendedor
// ativo na base, antes de cair em `admin_set_usuario_status`.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "./icon";
import { PerformanceResumoModal } from "@/components/acessos/performance-resumo-modal";
import { PERFORMANCE_STATUS_LABEL, PERFORMANCE_STATUS_CHIP } from "@/lib/performance-status";

type Kind = "master" | "franquia" | "vendedor";
type PerformanceStatus = "ativo" | "atencao" | "travado" | null;

type LinhaRede = {
  id: string; // profile id — alvo de Configurar/Excluir
  kind: Kind;
  nome: string;
  info: string;
  modalidade: "individual" | "full" | null;
  modeloId: string | null;
  modeloNome: string;
  ano: string;
  desligadoEm: string | null;
  performanceStatus: PerformanceStatus;
};

type ModeloOpcao = { id: string; nome: string };

function anoDe(aprovadaEm: string | null, createdAt: string): string {
  const base = aprovadaEm || createdAt;
  return base ? base.slice(0, 4) : "—";
}

export function CadastrosRedeTab() {
  const [linhas, setLinhas] = useState<LinhaRede[]>([]);
  const [modelos, setModelos] = useState<ModeloOpcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [fPerfil, setFPerfil] = useState("");
  const [fModelo, setFModelo] = useState("");
  const [fAno, setFAno] = useState("");
  const [busca, setBusca] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [configurando, setConfigurando] = useState<LinhaRede | null>(null);
  const [resumoPerf, setResumoPerf] = useState<LinhaRede | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      setLoading(true);
      setErr(null);

      const [rolesRes, modelosRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("user_id,role")
          .in("role", ["master", "franqueado", "vendedor"]),
        supabase.from("modelos_franquia").select("id,nome,modalidade").order("nome"),
      ]);
      if (!ativo) return;
      if (rolesRes.error) {
        setErr(rolesRes.error.message);
        setLoading(false);
        return;
      }
      const modelosData = (modelosRes.data ?? []) as (ModeloOpcao & {
        modalidade: "individual" | "full" | null;
      })[];
      setModelos(modelosData.map((m) => ({ id: m.id, nome: m.nome })));
      const modeloById = new Map(modelosData.map((m) => [m.id, m]));

      const roleByUser = new Map<string, "master" | "franqueado" | "vendedor">(
        (
          (rolesRes.data ?? []) as { user_id: string; role: "master" | "franqueado" | "vendedor" }[]
        ).map((r) => [r.user_id, r.role]),
      );
      const profileIds = Array.from(roleByUser.keys());
      if (profileIds.length === 0) {
        setLinhas([]);
        setLoading(false);
        return;
      }

      const { data: profilesData, error: profilesErr } = await supabase
        .from("profiles")
        .select(
          "id,nome,email,empresa_id,equipe,aprovada_em,created_at,desligado_em,status,performance_status",
        )
        .in("id", profileIds)
        .in("status", ["aprovada", "suspensa"]);
      if (!ativo) return;
      if (profilesErr) {
        setErr(profilesErr.message);
        setLoading(false);
        return;
      }
      type ProfileBruto = {
        id: string;
        nome: string;
        email: string;
        empresa_id: string | null;
        equipe: string | null;
        aprovada_em: string | null;
        created_at: string;
        desligado_em: string | null;
        status: string;
        performance_status: PerformanceStatus;
      };
      const profiles = (profilesData ?? []) as ProfileBruto[];
      const empresaIds = Array.from(
        new Set(profiles.map((p) => p.empresa_id).filter((id): id is string => !!id)),
      );

      const { data: empresasData } = await supabase
        .from("empresas")
        .select("id,nome,cidade,uf,parent_id,modelo_id")
        .in("id", empresaIds.length ? empresaIds : ["00000000-0000-0000-0000-000000000000"]);
      type EmpresaBruta = {
        id: string;
        nome: string;
        cidade: string | null;
        uf: string | null;
        parent_id: string | null;
        modelo_id: string | null;
      };
      const empresas = (empresasData ?? []) as EmpresaBruta[];
      const empresaById = new Map(empresas.map((e) => [e.id, e]));

      // Dono de cada empresa (Master ou Franqueado) — não há coluna "dono"
      // direta em `empresas`; o dono é o profile cujo empresa_id aponta pra
      // ela (mesmo padrão de `useAcessosData.ts`, franquiasAprovadas).
      const nomeDonoPorEmpresa = new Map<string, string>();
      for (const p of profiles) {
        const role = roleByUser.get(p.id);
        if (p.empresa_id && (role === "master" || role === "franqueado")) {
          nomeDonoPorEmpresa.set(p.empresa_id, p.nome);
        }
      }
      // Quantas franquias cada Master tem (empresas cujo parent_id é a empresa do Master).
      const franquiasPorMaster = new Map<string, number>();
      for (const e of empresas) {
        if (e.parent_id) {
          franquiasPorMaster.set(e.parent_id, (franquiasPorMaster.get(e.parent_id) ?? 0) + 1);
        }
      }

      const linhasNovas: LinhaRede[] = profiles.map((p) => {
        const role = roleByUser.get(p.id);
        const empresa = p.empresa_id ? empresaById.get(p.empresa_id) : undefined;
        const modelo = empresa?.modelo_id ? modeloById.get(empresa.modelo_id) : undefined;
        const ano = anoDe(p.aprovada_em, p.created_at);
        const base = {
          id: p.id,
          nome: p.nome,
          ano,
          desligadoEm: p.desligado_em,
          modeloId: empresa?.modelo_id ?? null,
          modeloNome: modelo?.nome ?? "",
          modalidade: modelo?.modalidade ?? null,
          performanceStatus: p.performance_status,
        };
        if (role === "master") {
          const nFranquias = p.empresa_id ? (franquiasPorMaster.get(p.empresa_id) ?? 0) : 0;
          return {
            ...base,
            kind: "master" as const,
            info: `${nFranquias} franquia(s)`,
          };
        }
        if (role === "franqueado") {
          const dono = empresa?.parent_id ? nomeDonoPorEmpresa.get(empresa.parent_id) : undefined;
          const local = [empresa?.cidade, empresa?.uf].filter(Boolean).join(" · ");
          return {
            ...base,
            kind: "franquia" as const,
            info: [local, dono ? `Master ${dono}` : "Matriz · direto"].filter(Boolean).join(" · "),
          };
        }
        return {
          ...base,
          kind: "vendedor" as const,
          info: [empresa?.nome, p.equipe].filter(Boolean).join(" · ") || "—",
        };
      });
      setLinhas(linhasNovas);
      setLoading(false);
    })();
    return () => {
      ativo = false;
    };
  }, [reloadTick]);

  const anos = useMemo(
    () =>
      Array.from(new Set(linhas.map((l) => l.ano)))
        .sort()
        .reverse(),
    [linhas],
  );

  const filtradas = useMemo(
    () =>
      linhas.filter((l) => {
        // V11 · C5 — fiel ao protótipo: com um Modelo selecionado, só franquias
        // daquele modelo aparecem (não é um "OU" com Perfil — combina com os
        // outros filtros, inclusive busca/ano, como o resto desta função).
        if (fModelo && !(l.kind === "franquia" && l.modeloId === fModelo)) return false;
        if (fPerfil && l.kind !== fPerfil) return false;
        if (fAno && l.ano !== fAno) return false;
        if (busca) {
          const alvo = `${l.nome} ${l.info} ${l.modeloNome}`.toLowerCase();
          if (!alvo.includes(busca.toLowerCase())) return false;
        }
        return true;
      }),
    [linhas, fPerfil, fModelo, fAno, busca],
  );

  function perfilLabel(l: LinhaRede): string {
    if (l.kind === "master") return "Master | franqueado";
    if (l.kind === "franquia")
      return `Franquia | ${l.modalidade === "individual" ? "Individual" : "Full"}`;
    return "Vendedor | rede";
  }

  async function excluir(l: LinhaRede) {
    const motivo = window.prompt(`Motivo do desligamento de ${l.nome} (obrigatório):`);
    if (motivo === null) return;
    if (!motivo.trim()) {
      window.alert("O motivo é obrigatório.");
      return;
    }
    const { error } = await supabase.rpc("excluir_cadastro_rede", {
      p_user_id: l.id,
      p_motivo: motivo.trim(),
    });
    if (error) {
      window.alert(error.message);
      return;
    }
    setReloadTick((t) => t + 1);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="muted small" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon id="info" size={13} /> Rede externa completa — Masters, franquias e vendedores. Todo
        cadastro nasce do <strong>Convite Supper</strong> (ou da exceção manual, registrada em log);
        aprovado, entra nesta lista.
      </div>

      {err && <div className="banner alert">{err}</div>}

      <div className="card">
        <div
          className="card-h"
          style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
        >
          <h3 style={{ marginRight: "auto" }}>
            <Icon id="building" size={16} /> Cadastros da Rede{" "}
            <span className="muted small" style={{ fontWeight: 500 }}>
              — {filtradas.length} de {linhas.length}
            </span>
          </h3>
          <input
            className="input"
            style={{ width: "auto", minWidth: 200 }}
            placeholder="Buscar nome, cidade, franquia…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select
            className="input"
            style={{ width: "auto", minWidth: 160 }}
            value={fPerfil}
            onChange={(e) => setFPerfil(e.target.value)}
          >
            <option value="">Perfil · todos</option>
            <option value="master">Master | franqueado</option>
            <option value="franquia">Franquia | rede</option>
            <option value="vendedor">Vendedor | rede</option>
          </select>
          <select
            className="input"
            style={{ width: "auto", minWidth: 180 }}
            value={fModelo}
            onChange={(e) => setFModelo(e.target.value)}
          >
            <option value="">Modelo · todos</option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
          <select
            className="input"
            style={{ width: "auto", minWidth: 110 }}
            value={fAno}
            onChange={(e) => setFAno(e.target.value)}
          >
            <option value="">Ano · todos</option>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          {(fPerfil || fModelo || fAno || busca) && (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => {
                setFPerfil("");
                setFModelo("");
                setFAno("");
                setBusca("");
              }}
            >
              <Icon id="x" size={12} /> Limpar
            </button>
          )}
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
                  <th>Cadastro</th>
                  <th>Perfil</th>
                  <th>Ano</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l) => {
                  const desligado = !!l.desligadoEm;
                  return (
                    <tr key={l.id}>
                      <td>
                        <strong>{l.nome}</strong>
                        <div className="small muted">{l.info}</div>
                      </td>
                      <td>
                        <span className="chip chip-yellow" style={{ fontSize: 10.5 }}>
                          {perfilLabel(l)}
                        </span>
                        {l.kind === "franquia" && l.modalidade !== "full" && l.modeloNome && (
                          <span
                            className="chip chip-outline"
                            style={{ fontSize: 10.5, marginLeft: 4 }}
                          >
                            {l.modeloNome}
                          </span>
                        )}
                      </td>
                      <td>{l.ano}</td>
                      <td>
                        <span className={`chip ${desligado ? "chip-outline" : "chip-ok"}`}>
                          {desligado ? "Desligado" : "Ativo"}
                        </span>
                        {l.performanceStatus &&
                          (l.kind === "vendedor" ||
                            (l.kind === "franquia" && l.modalidade === "individual")) && (
                            <button
                              type="button"
                              className={`chip ${PERFORMANCE_STATUS_CHIP[l.performanceStatus]}`}
                              style={{ marginLeft: 6, cursor: "pointer", border: "none" }}
                              onClick={() => setResumoPerf(l)}
                              title="Ver resumo de performance"
                            >
                              {PERFORMANCE_STATUS_LABEL[l.performanceStatus]}
                            </button>
                          )}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => setConfigurando(l)}
                        >
                          <Icon id="settings" size={12} /> Configurar
                        </button>{" "}
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => void excluir(l)}
                        >
                          <Icon id="trash" size={12} /> Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted small" style={{ padding: 14 }}>
                      {linhas.length
                        ? "Nenhum cadastro com esses filtros."
                        : "Nenhum cadastro ainda."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {configurando && (
        <div
          className="modal-host"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfigurando(null);
          }}
        >
          <div className="modal">
            <div className="modal-h">
              <Icon id="settings" size={18} />
              <h3>Configurar — {configurando.nome}</h3>
              <div
                className="x"
                onClick={() => setConfigurando(null)}
                role="button"
                aria-label="Fechar"
              >
                <Icon id="x" size={18} />
              </div>
            </div>
            <div className="modal-b">
              <div className="acc-sol">
                <span className="chip chip-yellow" style={{ fontSize: 10.5 }}>
                  {perfilLabel(configurando)}
                </span>{" "}
                &nbsp;{configurando.info}
              </div>
              <div className="clt-note" style={{ marginTop: 12 }}>
                <Icon id="info" size={15} />
                <div>
                  {configurando.kind === "vendedor" ? (
                    <>
                      Dados de desempenho e supervisão deste vendedor estão em{" "}
                      <strong>Vendedores</strong>.
                    </>
                  ) : (
                    <>
                      Modelo, comissionamento e condições d
                      {configurando.kind === "master" ? "este Master" : "esta franquia"} são
                      configurados em <strong>Franquias</strong> e{" "}
                      <strong>Personalização geral</strong>.
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button className="btn btn-slate" type="button" onClick={() => setConfigurando(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {resumoPerf && (
        <PerformanceResumoModal
          profileId={resumoPerf.id}
          nome={resumoPerf.nome}
          onClose={() => setResumoPerf(null)}
          onAlterado={() => setReloadTick((t) => t + 1)}
        />
      )}
    </div>
  );
}
