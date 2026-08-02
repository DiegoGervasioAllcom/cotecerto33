// V11 · C4 (Frente 3) — aba "Cadastros Matriz" (`accMatriz()` do protótipo r40).
//
// Colaboradores do time interno (cargo_id não nulo) + Vendedor Matriz — Modelo
// CLT (role='vendedor', sem cargo). A distinção de quem é "Vendedor Matriz" e
// quem é vendedor externo (Franquia/Master) não tem coluna própria — é a mesma
// dívida de modelagem da V10 registrada em ANALISE_LACUNAS_V11.md ("vendedor
// virou empresa"): todo aprovado tem `empresa_id`, interno ou não. O sinal
// confiável é `empresas.modelo_id`: só uma franquia tem modelo de franquia
// atribuído — o placeholder pessoal de um Vendedor Matriz nunca tem.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "./icon";

type CargoOpcao = { id: string; nome: string };

type LinhaBase = {
  id: string;
  nome: string;
  sobrenome: string | null;
  email: string;
  diretor: boolean;
  desligadoEm: string | null;
  ano: string;
  diasHorario: string;
  isVendedorClt: boolean;
  cargoId: string | null;
  cargoNome: string;
  areas: number | null;
};

function anoDe(periodoInicio: string | null, aprovadaEm: string | null, createdAt: string): string {
  const base = periodoInicio || aprovadaEm || createdAt;
  return base ? base.slice(0, 4) : "—";
}

function diasHorarioLabel(
  dias: string[] | null,
  horaInicio: string | null,
  horaFim: string | null,
): string {
  const d = dias && dias.length ? dias.join(", ") : "—";
  const h = horaInicio && horaFim ? `${horaInicio.slice(0, 5)}–${horaFim.slice(0, 5)}` : "";
  return h ? `${d} · ${h}` : d;
}

export function CadastrosMatrizTab({
  onConfigurar,
}: {
  onConfigurar: (profileId: string, isVendedorClt: boolean) => void;
}) {
  const [linhas, setLinhas] = useState<LinhaBase[]>([]);
  const [cargos, setCargos] = useState<CargoOpcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [fCargo, setFCargo] = useState("");
  const [fAno, setFAno] = useState("");
  const [busca, setBusca] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      setLoading(true);
      setErr(null);
      const [cargosRes, profilesRes] = await Promise.all([
        supabase.from("cargos").select("id,nome").order("nome"),
        supabase
          .from("profiles")
          .select(
            "id,nome,sobrenome,email,diretor,desligado_em,cargo_id,periodo_inicio,aprovada_em,created_at,dias_acesso,hora_inicio,hora_fim,empresa_id",
          )
          .not("empresa_id", "is", null),
      ]);
      if (!ativo) return;
      if (profilesRes.error) {
        setErr(profilesRes.error.message);
        setLoading(false);
        return;
      }
      const cargosData = (cargosRes.data ?? []) as CargoOpcao[];
      setCargos(cargosData);
      const cargoNomeById = new Map(cargosData.map((c) => [c.id, c.nome]));

      type ProfileBruto = {
        id: string;
        nome: string;
        sobrenome: string | null;
        email: string;
        diretor: boolean;
        desligado_em: string | null;
        cargo_id: string | null;
        periodo_inicio: string | null;
        aprovada_em: string | null;
        created_at: string;
        dias_acesso: string[] | null;
        hora_inicio: string | null;
        hora_fim: string | null;
        empresa_id: string;
      };
      const profiles = (profilesRes.data ?? []) as ProfileBruto[];

      // Só entram aqui: cargo_id definido (time interno) OU role='vendedor' sem
      // cargo cuja empresa vinculada não tem modelo de franquia (Vendedor
      // Matriz — nunca é dono/vinculado de uma franquia).
      const empresaIds = profiles.map((p) => p.empresa_id);
      const { data: empresasData } = await supabase
        .from("empresas")
        .select("id,modelo_id")
        .in("id", empresaIds.length ? empresaIds : ["00000000-0000-0000-0000-000000000000"]);
      const modeloPorEmpresa = new Map(
        ((empresasData ?? []) as { id: string; modelo_id: string | null }[]).map((e) => [
          e.id,
          e.modelo_id,
        ]),
      );

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id,role")
        .in(
          "user_id",
          profiles.map((p) => p.id),
        );
      const roleByUser = new Map(
        ((rolesData ?? []) as { user_id: string; role: string }[]).map((r) => [r.user_id, r.role]),
      );

      const internos = profiles.filter((p) => {
        if (p.cargo_id) return true;
        const role = roleByUser.get(p.id);
        return role === "vendedor" && modeloPorEmpresa.get(p.empresa_id) == null;
      });

      // Áreas: override por pessoa (profile_areas) substitui o preset por
      // completo (fn_areas_do_usuario) — mesma regra aqui.
      const { data: overridesData } = await supabase
        .from("profile_areas")
        .select("profile_id,area_chave")
        .in(
          "profile_id",
          internos.map((p) => p.id),
        );
      const overrideCountByProfile = new Map<string, number>();
      for (const o of (overridesData ?? []) as { profile_id: string; area_chave: string }[]) {
        overrideCountByProfile.set(
          o.profile_id,
          (overrideCountByProfile.get(o.profile_id) ?? 0) + 1,
        );
      }
      const cargoIdsComPreset = Array.from(
        new Set(internos.map((p) => p.cargo_id).filter((c): c is string => !!c)),
      );
      const { data: presetData } = await supabase
        .from("cargo_areas")
        .select("cargo_id,area_chave")
        .in("cargo_id", cargoIdsComPreset.length ? cargoIdsComPreset : ["__nenhum__"]);
      const presetCountByCargo = new Map<string, number>();
      for (const p of (presetData ?? []) as { cargo_id: string; area_chave: string }[]) {
        presetCountByCargo.set(p.cargo_id, (presetCountByCargo.get(p.cargo_id) ?? 0) + 1);
      }

      const linhasNovas: LinhaBase[] = internos.map((p) => {
        const isVendedorClt = !p.cargo_id;
        const cargoNome = isVendedorClt
          ? "Vendedor Matriz (Modelo CLT)"
          : (cargoNomeById.get(p.cargo_id!) ?? "Personalizado");
        const areas = isVendedorClt
          ? null
          : (overrideCountByProfile.get(p.id) ?? presetCountByCargo.get(p.cargo_id!) ?? 0);
        return {
          id: p.id,
          nome: p.nome,
          sobrenome: p.sobrenome,
          email: p.email,
          diretor: p.diretor,
          desligadoEm: p.desligado_em,
          ano: anoDe(p.periodo_inicio, p.aprovada_em, p.created_at),
          diasHorario: diasHorarioLabel(p.dias_acesso, p.hora_inicio, p.hora_fim),
          isVendedorClt,
          cargoId: p.cargo_id,
          cargoNome,
          areas,
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
        if (fCargo && (l.isVendedorClt ? "vend_matriz" : l.cargoId) !== fCargo) return false;
        if (fAno && l.ano !== fAno) return false;
        if (busca) {
          const alvo = `${l.nome} ${l.sobrenome ?? ""} ${l.email} ${l.cargoNome}`.toLowerCase();
          if (!alvo.includes(busca.toLowerCase())) return false;
        }
        return true;
      }),
    [linhas, fCargo, fAno, busca],
  );

  // "Excluir" no time interno é desligamento (soft) — `desligarMatriz` no
  // protótipo, sob o mesmo rótulo. Não há trava de rede aqui (isso é só em
  // Cadastros Rede, C6): ninguém do time interno tem franquia vinculada.
  // Motivo obrigatório adianta o C10 (ainda opcional no banco, já exigido aqui).
  async function excluir(l: LinhaBase) {
    const motivo = window.prompt(`Motivo do desligamento de ${l.nome} (obrigatório):`);
    if (motivo === null) return;
    if (!motivo.trim()) {
      window.alert("O motivo é obrigatório.");
      return;
    }
    const { error } = await supabase.rpc("admin_set_usuario_status", {
      p_user_id: l.id,
      p_ativo: false,
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
        <Icon id="info" size={13} /> Time interno da Matriz com acesso <strong>por escopo</strong>{" "}
        às áreas marcadas. Criação direta é a <strong>exceção</strong> — use "Cadastro manual ·
        exceção" no topo do bloco.
      </div>

      {err && <div className="banner alert">{err}</div>}

      <div className="card">
        <div
          className="card-h"
          style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
        >
          <h3 style={{ marginRight: "auto" }}>
            <Icon id="users" size={16} /> Cadastros da Matriz{" "}
            <span className="muted small" style={{ fontWeight: 500 }}>
              — {filtradas.length} de {linhas.length}
            </span>
          </h3>
          <input
            className="input"
            style={{ width: "auto", minWidth: 200 }}
            placeholder="Buscar nome, e-mail…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select
            className="input"
            style={{ width: "auto", minWidth: 180 }}
            value={fCargo}
            onChange={(e) => setFCargo(e.target.value)}
          >
            <option value="">Cargo · todos</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
            <option value="vend_matriz">Vendedor Matriz (Modelo CLT)</option>
          </select>
          <select
            className="input"
            style={{ width: "auto", minWidth: 120 }}
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
          {(fCargo || fAno || busca) && (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => {
                setFCargo("");
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
                  <th>Colaborador</th>
                  <th>Cargo</th>
                  <th>Áreas</th>
                  <th>Janela de acesso</th>
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
                        <strong>
                          {l.nome} {l.sobrenome ?? ""}
                        </strong>
                        {l.diretor && (
                          <span
                            className="chip chip-slate"
                            style={{ fontSize: 10, verticalAlign: "middle", marginLeft: 6 }}
                          >
                            Diretor
                          </span>
                        )}
                        <div className="small muted">{l.email}</div>
                      </td>
                      <td>{l.cargoNome}</td>
                      <td>{l.isVendedorClt ? "menu de venda" : `${l.areas ?? 0} área(s)`}</td>
                      <td>
                        <small className="muted">{l.diasHorario}</small>
                      </td>
                      <td>{l.ano}</td>
                      <td>
                        <span className={`chip ${desligado ? "chip-outline" : "chip-ok"}`}>
                          {desligado ? "Desligado" : "Ativo"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => onConfigurar(l.id, l.isVendedorClt)}
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
                    <td colSpan={7} className="muted small" style={{ padding: 14 }}>
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
    </div>
  );
}
