import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "@/components/operacao/acessos/icon";
import { maskCpfCnpj, maskTelefone, parseBRL } from "@/lib/masks";
import { CargoAreasFields, useCargos } from "@/components/acessos/cargo-areas-fields";
import {
  leadsDiaSchema,
  valorNaoNegativoSchema,
  checkOptionalNumber,
  checkOptionalEquipe,
} from "@/lib/schemas/classificacao-acesso.schema";

/**
 * "Configurar" da aba Cadastros Matriz (V11 · C4) — `buildCadMatrizModal()` do
 * protótipo. Dois modos: colaborador com cargo (dados gerais + janela de
 * acesso + cargo/áreas, via `CargoAreasFields` — a mesma peça da aprovação) ou
 * Vendedor Matriz CLT (equipe/salário/leads/supervisor, os únicos campos que já
 * existiam antes desta task).
 *
 * "Módulos futuros" do protótipo ficou de fora — são áreas que ainda não têm
 * tela nenhuma (`areas.disponivel=false`); não há o que configurar de verdade.
 */

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HORARIOS_INICIO = ["06:00", "07:00", "08:00", "09:00"];
const HORARIOS_FIM = ["17:00", "18:00", "19:00", "20:00"];
const SEXO_OPCOES = ["", "Masculino", "Feminino"];
const ESTADO_CIVIL_OPCOES = [
  "",
  "Casado(a)",
  "Solteiro(a)",
  "Viúvo(a)",
  "Divorciado(a)",
  "União estável",
];

type ProfileCompleto = {
  nome: string;
  sobrenome: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  funcao: string | null;
  estado_civil: string | null;
  telefone_residencial: string | null;
  telefone: string | null;
  telefone_comercial: string | null;
  email_pessoal: string | null;
  email: string;
  cargo_id: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  dias_acesso: string[] | null;
  equipe: string | null;
  salario_base: number | null;
  leads_dia: number | null;
  superior_id: string | null;
};

export function CadMatrizModal({
  profileId,
  isVendedorClt,
  onClose,
  onSalvo,
}: {
  profileId: string;
  isVendedorClt: boolean;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const cargosCatalogo = useCargos();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [sexo, setSexo] = useState("");
  const [funcao, setFuncao] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [telefoneResidencial, setTelefoneResidencial] = useState("");
  const [telefoneCelular, setTelefoneCelular] = useState("");
  const [telefoneComercial, setTelefoneComercial] = useState("");
  const [emailPessoal, setEmailPessoal] = useState("");
  const [email, setEmail] = useState("");

  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("18:00");
  const [dias, setDias] = useState<string[]>(["Seg", "Ter", "Qua", "Qui", "Sex"]);

  const [cargoId, setCargoId] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [areasIniciais, setAreasIniciais] = useState<string[] | undefined>(undefined);

  const [equipe, setEquipe] = useState("");
  const [salarioBase, setSalarioBase] = useState("");
  const [leadsDia, setLeadsDia] = useState("");
  const [superiorId, setSuperiorId] = useState("");
  const [superiores, setSuperiores] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "nome,sobrenome,cpf,data_nascimento,sexo,funcao,estado_civil,telefone_residencial,telefone,telefone_comercial,email_pessoal,email,cargo_id,periodo_inicio,periodo_fim,hora_inicio,hora_fim,dias_acesso,equipe,salario_base,leads_dia,superior_id",
        )
        .eq("id", profileId)
        .single();
      if (!ativo) return;
      if (error || !data) {
        setErro(error?.message ?? "Cadastro não encontrado.");
        setCarregando(false);
        return;
      }
      const p = data as ProfileCompleto;
      setNome(p.nome);
      setSobrenome(p.sobrenome ?? "");
      setCpf(p.cpf ?? "");
      setDataNascimento(p.data_nascimento ?? "");
      setSexo(p.sexo ?? "");
      setFuncao(p.funcao ?? "");
      setEstadoCivil(p.estado_civil ?? "");
      setTelefoneResidencial(p.telefone_residencial ?? "");
      setTelefoneCelular(p.telefone ?? "");
      setTelefoneComercial(p.telefone_comercial ?? "");
      setEmailPessoal(p.email_pessoal ?? "");
      setEmail(p.email);
      setPeriodoInicio(p.periodo_inicio ?? "");
      setPeriodoFim(p.periodo_fim ?? "");
      setHoraInicio(p.hora_inicio?.slice(0, 5) || "08:00");
      setHoraFim(p.hora_fim?.slice(0, 5) || "18:00");
      if (p.dias_acesso && p.dias_acesso.length) setDias(p.dias_acesso);
      setCargoId(p.cargo_id ?? "");
      setEquipe(p.equipe ?? "");
      setSalarioBase(p.salario_base != null ? String(p.salario_base) : "");
      setLeadsDia(p.leads_dia != null ? String(p.leads_dia) : "");
      setSuperiorId(p.superior_id ?? "");

      if (!isVendedorClt) {
        // Mesma regra de fn_areas_do_usuario: override por pessoa substitui o
        // preset por completo, se existir.
        const { data: overrideData } = await supabase
          .from("profile_areas")
          .select("area_chave")
          .eq("profile_id", profileId);
        const override = (overrideData ?? []) as { area_chave: string }[];
        if (override.length) {
          setAreasIniciais(override.map((r) => r.area_chave));
        } else if (p.cargo_id) {
          const { data: presetData } = await supabase
            .from("cargo_areas")
            .select("area_chave")
            .eq("cargo_id", p.cargo_id);
          setAreasIniciais(
            ((presetData ?? []) as { area_chave: string }[]).map((r) => r.area_chave),
          );
        } else {
          setAreasIniciais([]);
        }
      }
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isVendedorClt não muda no ciclo de vida do modal
  }, [profileId]);

  useEffect(() => {
    if (!isVendedorClt) return;
    void supabase
      .from("profiles")
      .select("id,nome")
      .in("cargo_id", ["matriz_total", "coord_com", "sup_vendas"])
      .is("desligado_em", null)
      .then(({ data }) => setSuperiores((data as { id: string; nome: string }[]) ?? []));
  }, [isVendedorClt]);

  function toggleDia(d: string) {
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function salvar() {
    setErro(null);
    if (!nome.trim()) {
      setErro("Informe o nome.");
      return;
    }
    if (!isVendedorClt && areas.length === 0) {
      setErro("Marque ao menos uma área.");
      return;
    }

    let equipeCheck: { value?: string | null; error?: string | null } = {};
    let salarioCheck: { value?: number | null; error?: string | null } = {};
    let leadsCheck: { value?: number | null; error?: string | null } = {};
    if (isVendedorClt) {
      equipeCheck = checkOptionalEquipe(equipe);
      if (equipeCheck.error) return setErro(equipeCheck.error);
      salarioCheck = checkOptionalNumber(salarioBase, parseBRL, valorNaoNegativoSchema);
      if (salarioCheck.error) return setErro(salarioCheck.error);
      leadsCheck = checkOptionalNumber(leadsDia, Number, leadsDiaSchema);
      if (leadsCheck.error) return setErro(leadsCheck.error);
    }

    setSalvando(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nome: nome.trim(),
        sobrenome: sobrenome.trim() || null,
        cpf: cpf.trim() || null,
        data_nascimento: dataNascimento || null,
        sexo: sexo || null,
        funcao: funcao.trim() || null,
        estado_civil: estadoCivil || null,
        telefone_residencial: telefoneResidencial.trim() || null,
        telefone: telefoneCelular.trim() || null,
        telefone_comercial: telefoneComercial.trim() || null,
        email_pessoal: emailPessoal.trim() || null,
        email: email.trim(),
        periodo_inicio: periodoInicio || null,
        periodo_fim: periodoFim || null,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        dias_acesso: dias,
        ...(isVendedorClt
          ? {
              equipe: equipeCheck.value ?? null,
              salario_base: salarioCheck.value ?? null,
              leads_dia: leadsCheck.value ?? null,
              superior_id: superiorId || null,
            }
          : { cargo_id: cargoId || null }),
      })
      .eq("id", profileId);
    if (error) {
      setSalvando(false);
      setErro(error.message);
      return;
    }

    if (!isVendedorClt) {
      // profile_areas é override completo (fn_areas_do_usuario): some se bater
      // com o preset do cargo, senão substitui pelo conjunto marcado aqui.
      const { data: presetData } = await supabase
        .from("cargo_areas")
        .select("area_chave")
        .eq("cargo_id", cargoId);
      const preset = new Set(
        ((presetData ?? []) as { area_chave: string }[]).map((r) => r.area_chave),
      );
      const igualAoPreset = areas.length === preset.size && areas.every((a) => preset.has(a));
      await supabase.from("profile_areas").delete().eq("profile_id", profileId);
      if (!igualAoPreset) {
        await supabase
          .from("profile_areas")
          .insert(areas.map((area_chave) => ({ profile_id: profileId, area_chave })));
      }
    }

    setSalvando(false);
    onSalvo();
  }

  return (
    <div
      className="modal-host"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal lg">
        <div className="modal-h">
          <Icon id="user" size={18} />
          <h3>Editar cadastro — {nome || "…"}</h3>
          <div className="x" onClick={onClose} role="button" aria-label="Fechar">
            <Icon id="x" size={18} />
          </div>
        </div>
        <div className="modal-b">
          {carregando ? (
            <div className="muted small" style={{ padding: 16 }}>
              Carregando…
            </div>
          ) : (
            <>
              <div className="acc-sec-t" style={{ marginTop: 0 }}>
                Dados gerais
              </div>
              <div className="acc-grid">
                <div className="field-group">
                  <label htmlFor="cad-cpf">CPF</label>
                  <input
                    id="cad-cpf"
                    className="input"
                    value={maskCpfCnpj(cpf)}
                    onChange={(e) => setCpf(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="cad-nome">Nome</label>
                  <input
                    id="cad-nome"
                    className="input"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="cad-sobrenome">Sobrenome</label>
                  <input
                    id="cad-sobrenome"
                    className="input"
                    value={sobrenome}
                    onChange={(e) => setSobrenome(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="cad-nasc">Data de nascimento</label>
                  <input
                    id="cad-nasc"
                    className="input"
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="cad-sexo">Sexo</label>
                  <select
                    id="cad-sexo"
                    className="input"
                    value={sexo}
                    onChange={(e) => setSexo(e.target.value)}
                  >
                    {SEXO_OPCOES.map((o) => (
                      <option key={o} value={o}>
                        {o || "—"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="cad-funcao">Função</label>
                  <input
                    id="cad-funcao"
                    className="input"
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="cad-ecivil">Estado civil</label>
                  <select
                    id="cad-ecivil"
                    className="input"
                    value={estadoCivil}
                    onChange={(e) => setEstadoCivil(e.target.value)}
                  >
                    {ESTADO_CIVIL_OPCOES.map((o) => (
                      <option key={o} value={o}>
                        {o || "—"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="cad-telres">Telefone residencial</label>
                  <input
                    id="cad-telres"
                    className="input"
                    value={maskTelefone(telefoneResidencial)}
                    onChange={(e) => setTelefoneResidencial(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="cad-telcel">Telefone celular</label>
                  <input
                    id="cad-telcel"
                    className="input"
                    value={maskTelefone(telefoneCelular)}
                    onChange={(e) => setTelefoneCelular(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="cad-telcom">Comercial</label>
                  <input
                    id="cad-telcom"
                    className="input"
                    value={maskTelefone(telefoneComercial)}
                    onChange={(e) => setTelefoneComercial(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="cad-emailp">E-mail pessoal</label>
                  <input
                    id="cad-emailp"
                    className="input"
                    type="email"
                    value={emailPessoal}
                    onChange={(e) => setEmailPessoal(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="cad-email">E-mail profissional</label>
                  <input
                    id="cad-email"
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="acc-sec-t">Janela de acesso</div>
              <div className="acc-grid">
                <div className="field-group">
                  <label htmlFor="cad-pini">Período — início</label>
                  <input
                    id="cad-pini"
                    className="input"
                    type="date"
                    value={periodoInicio}
                    onChange={(e) => setPeriodoInicio(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="cad-pfim">Período — fim</label>
                  <input
                    id="cad-pfim"
                    className="input"
                    type="date"
                    value={periodoFim}
                    onChange={(e) => setPeriodoFim(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="cad-hini">Horário início</label>
                  <select
                    id="cad-hini"
                    className="input"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                  >
                    {HORARIOS_INICIO.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="cad-hfim">Horário fim</label>
                  <select
                    id="cad-hfim"
                    className="input"
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                  >
                    {HORARIOS_FIM.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field-group" style={{ marginTop: 6 }}>
                <label>Dias da semana</label>
                <div className="acc-pills">
                  {DIAS_SEMANA.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`acc-pill ${dias.includes(d) ? "on" : ""}`}
                      onClick={() => toggleDia(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {isVendedorClt ? (
                <>
                  <div className="acc-sec-t">Parâmetros do vendedor (CLT)</div>
                  <div className="acc-grid">
                    <div className="field-group">
                      <label htmlFor="cad-superior">Reporta a (Supervisor)</label>
                      <select
                        id="cad-superior"
                        className="input"
                        value={superiorId}
                        onChange={(e) => setSuperiorId(e.target.value)}
                      >
                        <option value="">— Matriz (topo) —</option>
                        {superiores.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label htmlFor="cad-equipe">Equipe</label>
                      <input
                        id="cad-equipe"
                        className="input"
                        value={equipe}
                        onChange={(e) => setEquipe(e.target.value)}
                        placeholder="ex.: Novas Vendas"
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="cad-salario">Salário base (R$)</label>
                      <input
                        id="cad-salario"
                        className="input"
                        value={salarioBase}
                        onChange={(e) => setSalarioBase(e.target.value)}
                        placeholder="R$ 1.800,00"
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="cad-leads">Leads · média/dia útil</label>
                      <input
                        id="cad-leads"
                        className="input"
                        value={leadsDia}
                        onChange={(e) => setLeadsDia(e.target.value)}
                        placeholder="12"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="acc-sec-t">
                    Cargo / preset{" "}
                    <span className="muted small" style={{ fontWeight: 500 }}>
                      — pré-marca as áreas; ajuste se quiser
                    </span>
                  </div>
                  <CargoAreasFields
                    cargos={cargosCatalogo}
                    cargoId={cargoId}
                    setCargoId={setCargoId}
                    areas={areas}
                    setAreas={setAreas}
                    locked={false}
                    initialAreas={areasIniciais}
                  />
                </>
              )}

              {erro && (
                <div className="banner alert" style={{ marginTop: 12 }}>
                  {erro}
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-yellow"
            type="button"
            onClick={() => void salvar()}
            disabled={carregando || salvando}
          >
            <Icon id="check" size={14} /> {salvando ? "Salvando…" : "Salvar cadastro"}
          </button>
        </div>
      </div>
    </div>
  );
}
