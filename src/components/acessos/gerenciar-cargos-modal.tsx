import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "@/components/operacao/acessos/icon";

/**
 * "Cargos de acesso" (V11 · C4) — `gerenciarCargos()`/`buildCargoModal()` do
 * protótipo. Cargos são presets de área (H2/H3): esta tela cria, edita e
 * duplica; não há "excluir" (o protótipo também não tem — um cargo em uso não
 * pode desaparecer sob quem já o tem atribuído).
 *
 * RLS de `cargos`/`cargo_areas` já restringe escrita a matriz/coordenador
 * (H2/H3); esta tela não precisa de RPC própria.
 */

type AreaOpcao = { chave: string; label: string };
type CargoResumo = { id: string; nome: string; descricao: string | null; areasCount: number };
type CargoDraft = { id: string | null; nome: string; descricao: string; areas: string[] };

export function GerenciarCargosModal({
  onClose,
  onAlterado,
}: {
  onClose: () => void;
  onAlterado: () => void;
}) {
  const [modo, setModo] = useState<"lista" | "editar">("lista");
  const [cargos, setCargos] = useState<CargoResumo[]>([]);
  const [areasCatalogo, setAreasCatalogo] = useState<AreaOpcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [draft, setDraft] = useState<CargoDraft>({ id: null, nome: "", descricao: "", areas: [] });
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      setCarregando(true);
      const [cargosRes, areasRes, cargoAreasRes] = await Promise.all([
        supabase.from("cargos").select("id,nome,descricao").order("nome"),
        supabase.from("areas").select("chave,label").order("ordem"),
        supabase.from("cargo_areas").select("cargo_id,area_chave"),
      ]);
      if (!ativo) return;
      if (cargosRes.error) {
        setErro(cargosRes.error.message);
        setCarregando(false);
        return;
      }
      const contagem = new Map<string, number>();
      for (const ca of (cargoAreasRes.data ?? []) as { cargo_id: string; area_chave: string }[]) {
        contagem.set(ca.cargo_id, (contagem.get(ca.cargo_id) ?? 0) + 1);
      }
      setCargos(
        ((cargosRes.data ?? []) as { id: string; nome: string; descricao: string | null }[]).map(
          (c) => ({ ...c, areasCount: contagem.get(c.id) ?? 0 }),
        ),
      );
      setAreasCatalogo((areasRes.data ?? []) as AreaOpcao[]);
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [reloadTick]);

  function abrirNovo() {
    setErro(null);
    setDraft({ id: null, nome: "", descricao: "", areas: ["mdash"] });
    setModo("editar");
  }

  async function abrirEditar(id: string) {
    setErro(null);
    const [{ data: cargo }, { data: areasData }] = await Promise.all([
      supabase.from("cargos").select("id,nome,descricao").eq("id", id).single(),
      supabase.from("cargo_areas").select("area_chave").eq("cargo_id", id),
    ]);
    if (!cargo) return;
    setDraft({
      id: cargo.id,
      nome: cargo.nome,
      descricao: cargo.descricao ?? "",
      areas: ((areasData ?? []) as { area_chave: string }[]).map((a) => a.area_chave),
    });
    setModo("editar");
  }

  function toggleArea(chave: string) {
    setDraft((d) => ({
      ...d,
      areas: d.areas.includes(chave) ? d.areas.filter((a) => a !== chave) : [...d.areas, chave],
    }));
  }

  async function duplicar(id: string) {
    setErro(null);
    const [{ data: cargo }, { data: areasData }] = await Promise.all([
      supabase.from("cargos").select("nome,descricao").eq("id", id).single(),
      supabase.from("cargo_areas").select("area_chave").eq("cargo_id", id),
    ]);
    if (!cargo) return;
    const novoId = `cg-${crypto.randomUUID()}`;
    const { error } = await supabase
      .from("cargos")
      .insert({ id: novoId, nome: `${cargo.nome} (cópia)`, descricao: cargo.descricao });
    if (error) {
      setErro(error.message);
      return;
    }
    const areas = ((areasData ?? []) as { area_chave: string }[]).map((a) => a.area_chave);
    if (areas.length) {
      await supabase
        .from("cargo_areas")
        .insert(areas.map((area_chave) => ({ cargo_id: novoId, area_chave })));
    }
    setReloadTick((t) => t + 1);
    onAlterado();
  }

  async function salvar() {
    setErro(null);
    if (!draft.nome.trim()) {
      setErro("Informe o nome do cargo.");
      return;
    }
    if (draft.areas.length === 0) {
      setErro("Marque ao menos uma área.");
      return;
    }
    setSalvando(true);
    const id = draft.id ?? `cg-${crypto.randomUUID()}`;
    const { error } = draft.id
      ? await supabase
          .from("cargos")
          .update({ nome: draft.nome.trim(), descricao: draft.descricao.trim() || null })
          .eq("id", draft.id)
      : await supabase
          .from("cargos")
          .insert({ id, nome: draft.nome.trim(), descricao: draft.descricao.trim() || null });
    if (error) {
      setSalvando(false);
      setErro(error.message);
      return;
    }
    // cargo_areas é o preset inteiro deste cargo — substitui por completo, como
    // o profile_areas de uma pessoa (mesma lógica, escopo diferente).
    await supabase.from("cargo_areas").delete().eq("cargo_id", id);
    await supabase
      .from("cargo_areas")
      .insert(draft.areas.map((area_chave) => ({ cargo_id: id, area_chave })));
    setSalvando(false);
    setModo("lista");
    setReloadTick((t) => t + 1);
    onAlterado();
  }

  return (
    <div
      className="modal-host"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {modo === "lista" ? (
        <div className="modal lg">
          <div className="modal-h">
            <Icon id="shield" size={18} />
            <h3>Cargos de acesso</h3>
            <div className="x" onClick={onClose} role="button" aria-label="Fechar">
              <Icon id="x" size={18} />
            </div>
          </div>
          <div className="modal-b">
            <div className="muted small" style={{ marginBottom: 10 }}>
              <Icon id="info" size={13} /> Cargos são presets de áreas. Todos são editáveis e
              duplicáveis; crie novos conforme a necessidade.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <button className="btn btn-slate btn-sm" type="button" onClick={abrirNovo}>
                <Icon id="plus" size={13} /> Novo cargo
              </button>
            </div>
            {erro && (
              <div className="banner alert" style={{ marginBottom: 10 }}>
                {erro}
              </div>
            )}
            {carregando ? (
              <div className="muted small" style={{ padding: 16 }}>
                Carregando…
              </div>
            ) : (
              <table className="table-pipe">
                <thead>
                  <tr>
                    <th>Cargo</th>
                    <th>Áreas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cargos.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.nome}</strong>
                        <div className="small muted">{c.descricao ?? ""}</div>
                      </td>
                      <td>{c.areasCount} área(s)</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => void abrirEditar(c.id)}
                        >
                          <Icon id="settings" size={12} /> Editar
                        </button>{" "}
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => void duplicar(c.id)}
                        >
                          <Icon id="file" size={12} /> Duplicar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cargos.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted small" style={{ padding: 14 }}>
                        Nenhum cargo ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <div className="modal-f">
            <button className="btn btn-ghost" type="button" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      ) : (
        <div className="modal lg">
          <div className="modal-h">
            <Icon id="shield" size={18} />
            <h3>{draft.id ? "Editar cargo" : "Novo cargo"}</h3>
            <div className="x" onClick={onClose} role="button" aria-label="Fechar">
              <Icon id="x" size={18} />
            </div>
          </div>
          <div className="modal-b">
            <div className="acc-grid">
              <div className="field-group full">
                <label htmlFor="cg-nome">Nome do cargo</label>
                <input
                  id="cg-nome"
                  className="input"
                  value={draft.nome}
                  onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
                />
              </div>
              <div className="field-group full">
                <label htmlFor="cg-desc">Descrição</label>
                <input
                  id="cg-desc"
                  className="input"
                  value={draft.descricao}
                  onChange={(e) => setDraft((d) => ({ ...d, descricao: e.target.value }))}
                />
              </div>
            </div>
            <div className="acc-sec-t">Áreas do cargo</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
              {areasCatalogo.map((a) => {
                const on = draft.areas.includes(a.chave);
                return (
                  <label
                    key={a.chave}
                    className={`switch ${on ? "on" : ""}`}
                    style={{ padding: "5px 4px", cursor: "pointer" }}
                    onClick={() => toggleArea(a.chave)}
                  >
                    <span className="track" />
                    <span className="label">{a.label}</span>
                  </label>
                );
              })}
            </div>
            {erro && (
              <div className="banner alert" style={{ marginTop: 12 }}>
                {erro}
              </div>
            )}
          </div>
          <div className="modal-f">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setModo("lista")}
              disabled={salvando}
            >
              Voltar
            </button>
            <button
              className="btn btn-yellow"
              type="button"
              onClick={() => void salvar()}
              disabled={salvando}
            >
              <Icon id="check" size={14} /> {salvando ? "Salvando…" : "Salvar cargo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
