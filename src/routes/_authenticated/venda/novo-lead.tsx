import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/novo-lead")({
  head: () => ({ meta: [{ title: "Novo lead · CoteCerto" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
  component: Page,
});

// ---------- máscaras ----------
const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

function maskCpfCnpj(raw: string) {
  const d = onlyDigits(raw).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
function maskCel(raw: string) {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}
function maskFixo(raw: string) {
  const d = onlyDigits(raw).slice(0, 10);
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
}
function maskCep(raw: string) {
  return onlyDigits(raw).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}
function maskPlaca(raw: string) {
  // Mercosul: AAA0A00 | Antigo: AAA0000
  const v = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  if (v.length <= 3) return v;
  return v.slice(0, 3) + "-" + v.slice(3);
}
function maskAno(raw: string) {
  return onlyDigits(raw).slice(0, 4);
}
function maskBRL(raw: string) {
  const d = onlyDigits(raw);
  if (!d) return "";
  const n = parseInt(d, 10);
  return "R$ " + (Math.floor(n / 100)).toLocaleString("pt-BR") + "," + String(n % 100).padStart(2, "0");
}
function maskKm(raw: string) {
  const d = onlyDigits(raw);
  return d ? Number(d).toLocaleString("pt-BR") + " km" : "";
}

type Form = {
  // Segurado
  cpf: string; pessoa: string; nome: string; nomeSocial: string; nasc: string;
  sexo: string; estadoCivil: string; celular: string; telRes: string; email: string;
  cep: string; logradouro: string; bairro: string; cidade: string; uf: string;
  sms: "sim" | "nao";
  // Seguro
  tipoSeguro: string; ramo: string; categoria: string; vigIni: string; vigFim: string;
  ciaAtual: string; apoliceAtual: string; ciAtual: string; classeBonus: string;
  seguradorasSel: string[]; tipoCalculo: string; grupoProducao: string; campanha: string; observacoesCot: string;
  // Renovação (conditional)
  seguradoraAnterior: string; sucursalAnterior: string; apoliceAnterior: string;
  coberturaAnterior: string; statusApoliceAnterior: string; itemApoliceAnterior: string;
  inicioVigenciaAnterior: string; fimVigenciaAnterior: string;
  renovacaoMesmoVeiculo: string; renovacaoInclusaoCasco: string;
  qtdSinistrosParcialAnterior: string; ciApoliceAnterior: string;
  classeBonusAnterior: string; comissaoApoliceAnterior: string;
  bonusRenovacaoTodasSeguradoras: string;
  bonusAllianz: string; bonusSuhai: string; bonusPortoAzulItau: string;
  bonusMapfre: string; bonusTokio: string; bonusHdi: string;
  bonusBradesco: string; bonusYelumAliroIndiana: string;
  // Veículo
  placa: string; chassi: string; renavam: string; marca: string; modelo: string;
  anoModelo: string; anoFab: string; combustivel: string; cor: string; zeroKm: boolean;
  blindado: boolean; alienado: boolean; banco: string; usoComercial: string; kmMensal: string;
  // Perfil
  condutorMesmo: "sim" | "nao"; condCpf: string; condNome: string; condNasc: string;
  condSexo: string; condEstadoCivil: string; profissao: string; cepPernoite: string;
  garagemResid: boolean; garagemTrab: boolean; garagemEsc: boolean;
  jovens1825: "sim" | "nao";
  // Coberturas
  tipoCobertura: string; casco: string; cascoValor: string; franquia: string;
  appMorte: string; appInval: string; dmh: string; rcfDm: string; rcfDc: string;
  vidros: boolean; carroReserva: string; assist24: string;
};

const STEPS = ["Segurado", "Seguro", "Veículo", "Perfil", "Coberturas", "Cálculo"];
const SEGURADORAS = ["Porto Seguro", "Azul Seguros", "Bradesco Auto", "HDI", "Allianz"];

function Page() {
  const [step, setStep] = useState(0);
  const [cepLoading, setCepLoading] = useState(false);
  const [marcas, setMarcas] = useState<{ codigo: string; nome: string }[]>([]);
  const [modelos, setModelos] = useState<{ codigo: number; nome: string }[]>([]);
  const [fipeValor, setFipeValor] = useState<string>("");
  const [calculando, setCalculando] = useState(false);
  const [resultados, setResultados] = useState<{ cia: string; premio: number; cobertura: string }[]>([]);

  const [f, setF] = useState<Form>({
    cpf: "", pessoa: "Física", nome: "", nomeSocial: "", nasc: "", sexo: "",
    estadoCivil: "", celular: "", telRes: "", email: "",
    cep: "", logradouro: "", bairro: "", cidade: "", uf: "", sms: "nao",
    tipoSeguro: "Seguro novo", ramo: "Automóvel", categoria: "Particular", vigIni: "", vigFim: "",
    ciaAtual: "", apoliceAtual: "", ciAtual: "", classeBonus: "0",
    seguradorasSel: ["Mapfre", "Aliro", "Yelum", "HDI", "Suhai"],
    tipoCalculo: "Anual", grupoProducao: "", campanha: "", observacoesCot: "",
    seguradoraAnterior: "", sucursalAnterior: "", apoliceAnterior: "",
    coberturaAnterior: "Compreensiva", statusApoliceAnterior: "Em vigor", itemApoliceAnterior: "",
    inicioVigenciaAnterior: "", fimVigenciaAnterior: "",
    renovacaoMesmoVeiculo: "Sim", renovacaoInclusaoCasco: "Não",
    qtdSinistrosParcialAnterior: "", ciApoliceAnterior: "",
    classeBonusAnterior: "0", comissaoApoliceAnterior: "",
    bonusRenovacaoTodasSeguradoras: "0",
    bonusAllianz: "0", bonusSuhai: "0", bonusPortoAzulItau: "0",
    bonusMapfre: "0", bonusTokio: "0", bonusHdi: "0",
    bonusBradesco: "0", bonusYelumAliroIndiana: "0",
    placa: "", chassi: "", renavam: "", marca: "", modelo: "",
    anoModelo: "", anoFab: "", combustivel: "Flex", cor: "", zeroKm: false,
    blindado: false, alienado: false, banco: "", usoComercial: "Não", kmMensal: "",
    condutorMesmo: "sim", condCpf: "", condNome: "", condNasc: "", condSexo: "",
    condEstadoCivil: "", profissao: "", cepPernoite: "",
    garagemResid: true, garagemTrab: false, garagemEsc: false, jovens1825: "nao",
    tipoCobertura: "Compreensiva", casco: "100% Tabela FIPE", cascoValor: "", franquia: "Normal",
    appMorte: "", appInval: "", dmh: "", rcfDm: "", rcfDc: "",
    vidros: true, carroReserva: "7 dias", assist24: "Básica",
  });
  const up = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  // ----- persistência: cotação no Supabase -----
  const { id: routeId } = Route.useSearch();
  const [cotacaoId, setCotacaoId] = useState<string | null>(routeId ?? null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);
  const loadingRef = useRef<boolean>(!!routeId);
  const [loading, setLoading] = useState<boolean>(!!routeId);

  function buildPayload(extra?: { premios?: typeof resultados }) {
    return {
      step_atual: step,
      segurado: {
        cpf: f.cpf, pessoa: f.pessoa, nome: f.nome, nome_social: f.nomeSocial, nasc: f.nasc,
        sexo: f.sexo, estado_civil: f.estadoCivil, celular: f.celular, tel_res: f.telRes, email: f.email,
        cep: f.cep, logradouro: f.logradouro, bairro: f.bairro, cidade: f.cidade, uf: f.uf,
        sms_optin: f.sms === "sim",
      },
      seguro: {
        tipo_seguro: f.tipoSeguro, ramo: f.ramo, categoria: f.categoria,
        vig_ini: f.vigIni, vig_fim: f.vigFim,
        cia_atual: f.ciaAtual, apolice_atual: f.apoliceAtual, ci_atual: f.ciAtual, classe_bonus: f.classeBonus,
      },
      veiculo: {
        placa: f.placa, chassi: f.chassi, renavam: f.renavam,
        marca_codigo: f.marca, marca_nome: marcas.find((m) => m.codigo === f.marca)?.nome || "",
        modelo_codigo: f.modelo, modelo_nome: modelos.find((m) => String(m.codigo) === f.modelo)?.nome || "",
        ano_modelo: f.anoModelo, ano_fab: f.anoFab, combustivel: f.combustivel, cor: f.cor,
        zero_km: f.zeroKm, blindado: f.blindado, alienado: f.alienado, banco: f.banco,
        uso_comercial: f.usoComercial, km_mensal: f.kmMensal, fipe_valor: fipeValor,
      },
      perfil: {
        condutor_mesmo: f.condutorMesmo === "sim",
        cond_cpf: f.condCpf, cond_nome: f.condNome, cond_nasc: f.condNasc,
        cond_sexo: f.condSexo, cond_estado_civil: f.condEstadoCivil,
        profissao: f.profissao, cep_pernoite: f.cepPernoite,
        garagem_resid: f.garagemResid, garagem_trab: f.garagemTrab, garagem_esc: f.garagemEsc,
        jovens_18_25: f.jovens1825 === "sim",
      },
      coberturas: {
        tipo_cobertura: f.tipoCobertura, casco: f.casco, casco_valor: f.cascoValor, franquia: f.franquia,
        app_morte: f.appMorte, app_invalidez: f.appInval, dmh: f.dmh, rcf_dm: f.rcfDm, rcf_dc: f.rcfDc,
        vidros: f.vidros, carro_reserva: f.carroReserva, assist_24: f.assist24,
      },
      ...(extra?.premios ? { premios: extra.premios.map((p) => ({ seguradora: (p as any).cia ?? (p as any).seguradora, premio: p.premio, cobertura: p.cobertura })) } : {}),
    };
  }

  async function persistir(extra?: { premios?: typeof resultados }) {
    // só persiste se tiver algo identificador mínimo
    if (!f.cpf && !f.nome && !cotacaoId) return;
    setSaveState("saving");
    const { data, error } = await supabase.rpc("salvar_cotacao_rascunho", {
      p_cotacao_id: cotacaoId,
      p_payload: buildPayload(extra) as never,
    });
    if (error) {
      console.error("[cotacao] save error", error);
      setSaveState("error");
      return;
    }
    if (data && !cotacaoId) setCotacaoId(data as string);
    setSaveState("saved");
    setLastSavedAt(new Date());
  }

  // auto-save com debounce
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (loadingRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persistir(); }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, step]);

  // carregar rascunho existente quando ?id=
  useEffect(() => {
    if (!routeId) return;
    let cancel = false;
    (async () => {
      const { data, error } = await supabase
        .from("cotacoes")
        .select(
          "id,step_atual,ramo," +
          "segurado:cotacao_segurado(*)," +
          "seguro:cotacao_seguro(*)," +
          "veiculo:cotacao_veiculo(*)," +
          "perfil:cotacao_perfil(*)," +
          "coberturas:cotacao_coberturas(*)," +
          "premios:cotacao_premios(seguradora,cobertura,premio)"
        )
        .eq("id", routeId)
        .maybeSingle();
      if (cancel) return;
      if (error || !data) { loadingRef.current = false; setLoading(false); return; }
      const s = (data as any).segurado || {};
      const sg = (data as any).seguro || {};
      const v = (data as any).veiculo || {};
      const p = (data as any).perfil || {};
      const c = (data as any).coberturas || {};
      const pr = ((data as any).premios || []) as { seguradora: string; cobertura: string; premio: number }[];
      setStep(Number((data as any).step_atual ?? 0));
      setF((prev) => ({
        ...prev,
        cpf: s.cpf_cnpj ?? "", pessoa: s.pessoa ?? prev.pessoa, nome: s.nome ?? "", nomeSocial: s.nome_social ?? "",
        nasc: s.nascimento ?? "", sexo: s.sexo ?? "", estadoCivil: s.estado_civil ?? "",
        celular: s.celular ?? "", telRes: s.tel_res ?? "", email: s.email ?? "",
        cep: s.cep ?? "", logradouro: s.logradouro ?? "", bairro: s.bairro ?? "",
        cidade: s.cidade ?? "", uf: s.uf ?? "", sms: s.sms_optin ? "sim" : "nao",
        tipoSeguro: sg.tipo_seguro ?? prev.tipoSeguro, ramo: sg.ramo ?? prev.ramo,
        categoria: sg.categoria ?? prev.categoria, vigIni: sg.vig_ini ?? "", vigFim: sg.vig_fim ?? "",
        ciaAtual: sg.cia_atual ?? "", apoliceAtual: sg.apolice_atual ?? "",
        ciAtual: sg.ci_atual ?? "", classeBonus: sg.classe_bonus ?? "0",
        placa: v.placa ?? "", chassi: v.chassi ?? "", renavam: v.renavam ?? "",
        marca: v.marca_codigo ?? "", modelo: v.modelo_codigo ?? "",
        anoModelo: v.ano_modelo ?? "", anoFab: v.ano_fab ?? "",
        combustivel: v.combustivel ?? prev.combustivel, cor: v.cor ?? "",
        zeroKm: !!v.zero_km, blindado: !!v.blindado, alienado: !!v.alienado,
        banco: v.banco ?? "", usoComercial: v.uso_comercial ?? prev.usoComercial, kmMensal: v.km_mensal ?? "",
        condutorMesmo: p.condutor_mesmo === false ? "nao" : "sim",
        condCpf: p.cond_cpf ?? "", condNome: p.cond_nome ?? "", condNasc: p.cond_nasc ?? "",
        condSexo: p.cond_sexo ?? "", condEstadoCivil: p.cond_estado_civil ?? "",
        profissao: p.profissao ?? "", cepPernoite: p.cep_pernoite ?? "",
        garagemResid: p.garagem_resid ?? prev.garagemResid,
        garagemTrab: !!p.garagem_trab, garagemEsc: !!p.garagem_esc,
        jovens1825: p.jovens_18_25 ? "sim" : "nao",
        tipoCobertura: c.tipo_cobertura ?? prev.tipoCobertura, casco: c.casco ?? prev.casco,
        cascoValor: c.casco_valor ?? "", franquia: c.franquia ?? prev.franquia,
        appMorte: c.app_morte ?? "", appInval: c.app_invalidez ?? "", dmh: c.dmh ?? "",
        rcfDm: c.rcf_dm ?? "", rcfDc: c.rcf_dc ?? "",
        vidros: c.vidros ?? prev.vidros, carroReserva: c.carro_reserva ?? prev.carroReserva,
        assist24: c.assist_24 ?? prev.assist24,
      }));
      if (v.fipe_valor) setFipeValor(v.fipe_valor);
      if (v.marca_codigo && v.marca_nome) setMarcas((m) => m.some((x) => x.codigo === v.marca_codigo) ? m : [...m, { codigo: v.marca_codigo, nome: v.marca_nome }]);
      if (v.modelo_codigo && v.modelo_nome) setModelos((m) => m.some((x) => String(x.codigo) === String(v.modelo_codigo)) ? m : [...m, { codigo: Number(v.modelo_codigo), nome: v.modelo_nome }]);
      if (pr.length) setResultados(pr.map((x) => ({ cia: x.seguradora, premio: Number(x.premio), cobertura: x.cobertura })));
      setCotacaoId(routeId);
      setLastSavedAt(new Date());
      setSaveState("saved");
      // libera autosave após dois ticks pra evitar disparo pelo setF
      setTimeout(() => { loadingRef.current = false; setLoading(false); }, 50);
    })();
    return () => { cancel = true; };
  }, [routeId]);


  async function lookupCep(cep: string, prefix: "" | "cond" = "") {
    const d = onlyDigits(cep);
    if (d.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (!j.erro && !prefix) {
        setF((p) => ({ ...p, logradouro: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade || "", uf: j.uf || "" }));
      }
    } catch { /* noop */ } finally { setCepLoading(false); }
  }

  // FIPE: marcas
  useEffect(() => {
    fetch("https://parallelum.com.br/fipe/api/v1/carros/marcas")
      .then((r) => r.json()).then(setMarcas).catch(() => setMarcas([]));
  }, []);
  // FIPE: modelos quando marca muda
  useEffect(() => {
    if (!f.marca) { setModelos([]); return; }
    fetch(`https://parallelum.com.br/fipe/api/v1/carros/marcas/${f.marca}/modelos`)
      .then((r) => r.json()).then((j) => setModelos(j.modelos || [])).catch(() => setModelos([]));
  }, [f.marca]);
  // FIPE: valor quando modelo+ano
  useEffect(() => {
    if (!f.marca || !f.modelo || !f.anoModelo) { setFipeValor(""); return; }
    const combCode = f.combustivel === "Diesel" ? 3 : f.combustivel === "Álcool" ? 2 : 1;
    fetch(`https://parallelum.com.br/fipe/api/v1/carros/marcas/${f.marca}/modelos/${f.modelo}/anos/${f.anoModelo}-${combCode}`)
      .then((r) => r.json()).then((j) => setFipeValor(j.Valor || "")).catch(() => setFipeValor(""));
  }, [f.marca, f.modelo, f.anoModelo, f.combustivel]);

  function simularCalculo() {
    setCalculando(true);
    setResultados([]);
    setTimeout(() => {
      const base = fipeValor ? Number(onlyDigits(fipeValor)) / 100 : 60000;
      const fator = f.tipoCobertura === "Compreensiva" ? 0.035 : f.tipoCobertura === "RCF" ? 0.012 : 0.020;
      const novos = SEGURADORAS.map((cia, i) => ({
        cia,
        premio: Math.round(base * fator * (0.85 + i * 0.07)),
        cobertura: f.tipoCobertura,
      }));
      setResultados(novos);
      setCalculando(false);
      // persiste prêmios no banco mapeando para o shape do RPC
      void persistir({ premios: novos.map((r) => ({ cia: r.cia, premio: r.premio, cobertura: r.cobertura })) as never });
    }, 900);
  }

  const podeCalcular = !!(f.cpf && f.nome && f.marca && f.modelo && f.anoModelo);

  return (
    <AppShell title="Novo lead">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Nova cotação <span className="chip chip-slate" style={{ marginLeft: 6, verticalAlign: "middle" }}>Novo</span></h1>
          <div className="sub">Multi cálculo · Padrão Automóvel · espelha o fluxo de cotação do Quiver com a cara da Supper.</div>
        </div>
        <div className="tools">
          <button className="btn btn-ghost"><svg width="14" height="14"><use href="#i-message" /></svg> WhatsApp</button>
          <button className="btn btn-ghost"><svg width="14" height="14"><use href="#i-history" /></svg> Histórico</button>
          <button className="btn btn-ghost"><svg width="14" height="14"><use href="#i-flag" /></svg> Classificar perda</button>
        </div>
      </div>
      {loading && <div className="muted" style={{ marginBottom: 8 }}>Carregando rascunho…</div>}

      <div className="stepper">
        {STEPS.map((label, i) => (
          <span key={label} style={{ display: "contents" }}>
            <div className={"step " + (i === step ? "current" : "")} onClick={() => setStep(i)} style={{ cursor: "pointer" }}>
              <div className="n">{i + 1}</div>
              <div className="lbl">{label}</div>
            </div>
            {i < STEPS.length - 1 && <div className="line " />}
          </span>
        ))}
        {podeCalcular && <span className="ready "><svg width="12" height="12"><use href="#i-check" /></svg> Pronto para cotar</span>}
      </div>

      <div className="lead-shell">
        <div className="wizard-card">
          {step === 0 && (
            <>
              <h2>Dados do Segurado</h2>
              <div className="sub">Digite o CPF/CNPJ que o sistema busca o cadastro. Se for novo, preenche o resto manualmente.</div>
              <div className="wizard-grid">
                <div className="field-group">
                  <label>CPF ou CNPJ<span className="req">*</span></label>
                  <input className="input" value={f.cpf} inputMode="numeric"
                    onChange={(e) => up("cpf", maskCpfCnpj(e.target.value))} placeholder="000.000.000-00" />
                </div>
                <div className="field-group">
                  <label>Pessoa</label>
                  <select className="input" value={f.pessoa} onChange={(e) => up("pessoa", e.target.value)}>
                    <option>Física</option><option>Jurídica</option>
                  </select>
                </div>
                <div className="field-group full">
                  <label>Nome<span className="req">*</span></label>
                  <input className="input" value={f.nome} onChange={(e) => up("nome", e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="field-group full">
                  <label>Nome social</label>
                  <input className="input" value={f.nomeSocial} onChange={(e) => up("nomeSocial", e.target.value)} placeholder="Opcional" />
                </div>
                <div className="field-group">
                  <label>Data de nascimento<span className="req">*</span></label>
                  <input className="input" type="date" value={f.nasc} onChange={(e) => up("nasc", e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Sexo<span className="req">*</span></label>
                  <div className="row" style={{ gap: 8, paddingTop: 4 }}>
                    {["Masculino", "Feminino"].map((s) => (
                      <span key={s} className={"chip " + (f.sexo === s ? "chip-slate" : "chip-outline")}
                        style={{ cursor: "pointer" }} onClick={() => up("sexo", s)}>{s}</span>
                    ))}
                  </div>
                </div>
                <div className="field-group">
                  <label>Estado civil<span className="req">*</span></label>
                  <select className="input" value={f.estadoCivil} onChange={(e) => up("estadoCivil", e.target.value)}>
                    <option value="">Selecione</option>
                    <option>Casado(a)</option><option>Solteiro(a)</option><option>Viúvo(a)</option>
                    <option>Divorciado(a)</option><option>Separado(a)</option><option>União estável</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Telefone celular<span className="req">*</span> <span className="hint">WhatsApp</span></label>
                  <input className="input" value={f.celular} inputMode="numeric"
                    onChange={(e) => up("celular", maskCel(e.target.value))} placeholder="(00) 00000-0000" />
                </div>
                <div className="field-group">
                  <label>Telefone residencial</label>
                  <input className="input" value={f.telRes} inputMode="numeric"
                    onChange={(e) => up("telRes", maskFixo(e.target.value))} placeholder="(00) 0000-0000" />
                </div>
                <div className="field-group full">
                  <label>E-mail</label>
                  <input className="input" type="email" value={f.email}
                    onChange={(e) => up("email", e.target.value)} placeholder="cliente@email.com" />
                </div>
                <div className="field-group">
                  <label>CEP residencial<span className="req">*</span></label>
                  <input className="input" value={f.cep} inputMode="numeric"
                    onChange={(e) => {
                      const v = maskCep(e.target.value); up("cep", v);
                      if (onlyDigits(v).length === 8) lookupCep(v);
                    }}
                    onBlur={() => lookupCep(f.cep)} placeholder="00000-000" />
                  {cepLoading && <span className="hint">Buscando CEP…</span>}
                </div>
                <div className="field-group">
                  <label>Logradouro</label>
                  <input className="input" value={f.logradouro} onChange={(e) => up("logradouro", e.target.value)} placeholder="Preenche via CEP" />
                </div>
                <div className="field-group">
                  <label>Bairro</label>
                  <input className="input" value={f.bairro} onChange={(e) => up("bairro", e.target.value)} placeholder="Preenche via CEP" />
                </div>
                <div className="field-group">
                  <label>Cidade</label>
                  <input className="input" value={f.cidade} onChange={(e) => up("cidade", e.target.value)} placeholder="Preenche via CEP" />
                </div>
                <div className="field-group">
                  <label>UF</label>
                  <input className="input" value={f.uf} maxLength={2}
                    onChange={(e) => up("uf", e.target.value.toUpperCase())} placeholder="UF" />
                </div>
                <div className="field-group">
                  <label>Autorizo o envio por SMS</label>
                  <div className="row" style={{ gap: 14, paddingTop: 6 }}>
                    <label><input type="radio" name="sms" checked={f.sms === "sim"} onChange={() => up("sms", "sim")} /> Sim</label>
                    <label><input type="radio" name="sms" checked={f.sms === "nao"} onChange={() => up("sms", "nao")} /> Não</label>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2>Dados do Seguro</h2>
              <div className="sub">Seguradoras para o cálculo, tipo de seguro e vigência.</div>

              <div className="field-group" style={{ marginTop: 8 }}>
                <label>
                  Seguradoras disponíveis{" "}
                  <span className="muted" style={{ fontWeight: 400 }}>marque e desmarque para o cálculo</span>
                </label>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", paddingTop: 6 }}>
                  {["Mapfre", "Aliro", "Yelum", "HDI", "Suhai", "Porto", "Azul", "Itaú", "Tokio"].map((s) => {
                    const on = f.seguradorasSel.includes(s);
                    return (
                      <span
                        key={s}
                        className={"chip " + (on ? "chip-yellow" : "chip-outline")}
                        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                        onClick={() =>
                          up(
                            "seguradorasSel",
                            on ? f.seguradorasSel.filter((x) => x !== s) : [...f.seguradorasSel, s]
                          )
                        }
                      >
                        {on && <svg width="10" height="10"><use href="#i-check" /></svg>}
                        {s}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="wizard-grid">
                <div className="field-group">
                  <label>Tipo de seguro<span className="req">*</span></label>
                  <select className="input" value={f.tipoSeguro} onChange={(e) => up("tipoSeguro", e.target.value)}>
                    <option>Seguro novo</option>
                    <option>Renovação congênere</option>
                    <option>Renovação</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Tipo de cálculo</label>
                  <select className="input" value={f.tipoCalculo} onChange={(e) => up("tipoCalculo", e.target.value)}>
                    <option>Anual</option>
                    <option>Mensal</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Tipo de cobertura</label>
                  <select className="input" value={f.tipoCobertura} onChange={(e) => up("tipoCobertura", e.target.value)}>
                    <option>Compreensiva</option>
                    <option>RCF</option>
                    <option>Incêndio e Roubo</option>
                  </select>
                </div>

                <div className="field-group">
                  <label>Período de vigência<span className="req">*</span></label>
                  <input className="input" type="date" value={f.vigIni} onChange={(e) => up("vigIni", e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Até</label>
                  <input className="input" type="date" value={f.vigFim} onChange={(e) => up("vigFim", e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Grupo de produção<span className="req">*</span></label>
                  <input className="input" value={f.grupoProducao} onChange={(e) => up("grupoProducao", e.target.value)} />
                </div>

                <div className="field-group" style={{ gridColumn: "span 1" }}>
                  <label>Campanha</label>
                  <select className="input" value={f.campanha} onChange={(e) => up("campanha", e.target.value)}>
                    <option value="">Selecione</option>
                  </select>
                </div>
              </div>

              <div className="field-group" style={{ marginTop: 12 }}>
                <label>Observações para a cotação</label>
                <textarea
                  className="input"
                  rows={4}
                  placeholder="Anotações internas desta cotação"
                  value={f.observacoesCot}
                  onChange={(e) => up("observacoesCot", e.target.value)}
                />
              </div>

              {f.tipoSeguro !== "Seguro novo" && (
                <div className="wizard-grid" style={{ marginTop: 12 }}>
                  <div className="field-group">
                    <label>Seguradora atual</label>
                    <select className="input" value={f.ciaAtual} onChange={(e) => up("ciaAtual", e.target.value)}>
                      <option value="">Selecione</option>
                      {SEGURADORAS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field-group">
                    <label>Apólice atual</label>
                    <input className="input" value={f.apoliceAtual} onChange={(e) => up("apoliceAtual", e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label>CI atual</label>
                    <input className="input" value={f.ciAtual} onChange={(e) => up("ciAtual", e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label>Classe de bônus</label>
                    <select className="input" value={f.classeBonus} onChange={(e) => up("classeBonus", e.target.value)}>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n}>{String(n)}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h2>Dados do Veículo</h2>
              <div className="sub">Marca / Modelo via Tabela FIPE. Valor sugerido aparece automaticamente.</div>
              <div className="wizard-grid">
                <div className="field-group">
                  <label>Placa</label>
                  <input className="input" value={f.placa}
                    onChange={(e) => up("placa", maskPlaca(e.target.value))} placeholder="AAA-0A00" />
                </div>
                <div className="field-group">
                  <label>Chassi</label>
                  <input className="input" value={f.chassi} maxLength={17}
                    onChange={(e) => up("chassi", e.target.value.toUpperCase())} placeholder="17 caracteres" />
                </div>
                <div className="field-group">
                  <label>Renavam</label>
                  <input className="input" value={f.renavam} inputMode="numeric"
                    onChange={(e) => up("renavam", onlyDigits(e.target.value).slice(0, 11))} />
                </div>
                <div className="field-group">
                  <label>Zero KM</label>
                  <div className="row" style={{ gap: 14, paddingTop: 6 }}>
                    <label><input type="checkbox" checked={f.zeroKm} onChange={(e) => up("zeroKm", e.target.checked)} /> Sim</label>
                  </div>
                </div>
                <div className="field-group">
                  <label>Marca<span className="req">*</span></label>
                  <select className="input" value={f.marca} onChange={(e) => { up("marca", e.target.value); up("modelo", ""); }}>
                    <option value="">Selecione</option>
                    {marcas.map((m) => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
                  </select>
                </div>
                <div className="field-group full">
                  <label>Modelo<span className="req">*</span></label>
                  <select className="input" value={f.modelo} onChange={(e) => up("modelo", e.target.value)} disabled={!f.marca}>
                    <option value="">{f.marca ? "Selecione" : "Selecione a marca antes"}</option>
                    {modelos.map((m) => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label>Ano modelo<span className="req">*</span></label>
                  <input className="input" value={f.anoModelo} inputMode="numeric"
                    onChange={(e) => up("anoModelo", maskAno(e.target.value))} placeholder="2024" />
                </div>
                <div className="field-group">
                  <label>Ano fabricação</label>
                  <input className="input" value={f.anoFab} inputMode="numeric"
                    onChange={(e) => up("anoFab", maskAno(e.target.value))} placeholder="2023" />
                </div>
                <div className="field-group">
                  <label>Combustível</label>
                  <select className="input" value={f.combustivel} onChange={(e) => up("combustivel", e.target.value)}>
                    <option>Flex</option><option>Gasolina</option><option>Álcool</option><option>Diesel</option><option>Elétrico</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Cor</label>
                  <input className="input" value={f.cor} onChange={(e) => up("cor", e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Valor FIPE</label>
                  <input className="input" value={fipeValor} readOnly style={{ background: "var(--offwhite)" }} placeholder="Preenche via FIPE" />
                </div>
                <div className="field-group">
                  <label>Blindado</label>
                  <div className="row" style={{ gap: 14, paddingTop: 6 }}>
                    <label><input type="checkbox" checked={f.blindado} onChange={(e) => up("blindado", e.target.checked)} /> Sim</label>
                  </div>
                </div>
                <div className="field-group">
                  <label>Alienado</label>
                  <div className="row" style={{ gap: 14, paddingTop: 6 }}>
                    <label><input type="checkbox" checked={f.alienado} onChange={(e) => up("alienado", e.target.checked)} /> Sim</label>
                  </div>
                </div>
                {f.alienado && (
                  <div className="field-group">
                    <label>Banco / Financeira</label>
                    <input className="input" value={f.banco} onChange={(e) => up("banco", e.target.value)} />
                  </div>
                )}
                <div className="field-group">
                  <label>Uso comercial</label>
                  <select className="input" value={f.usoComercial} onChange={(e) => up("usoComercial", e.target.value)}>
                    <option>Não</option><option>Sim</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>KM mensal</label>
                  <input className="input" value={f.kmMensal} inputMode="numeric"
                    onChange={(e) => up("kmMensal", maskKm(e.target.value))} placeholder="1.000 km" />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2>Perfil do Condutor</h2>
              <div className="sub">Quem dirige o veículo na maior parte do tempo e detalhes de uso.</div>
              <div className="wizard-grid">
                <div className="field-group full">
                  <label>Condutor principal é o próprio segurado?</label>
                  <div className="row" style={{ gap: 14, paddingTop: 6 }}>
                    <label><input type="radio" name="cond" checked={f.condutorMesmo === "sim"} onChange={() => up("condutorMesmo", "sim")} /> Sim</label>
                    <label><input type="radio" name="cond" checked={f.condutorMesmo === "nao"} onChange={() => up("condutorMesmo", "nao")} /> Não</label>
                  </div>
                </div>
                {f.condutorMesmo === "nao" && (
                  <>
                    <div className="field-group">
                      <label>CPF do condutor</label>
                      <input className="input" value={f.condCpf} inputMode="numeric"
                        onChange={(e) => up("condCpf", maskCpfCnpj(e.target.value))} placeholder="000.000.000-00" />
                    </div>
                    <div className="field-group full">
                      <label>Nome do condutor</label>
                      <input className="input" value={f.condNome} onChange={(e) => up("condNome", e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label>Nascimento</label>
                      <input className="input" type="date" value={f.condNasc} onChange={(e) => up("condNasc", e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label>Sexo</label>
                      <select className="input" value={f.condSexo} onChange={(e) => up("condSexo", e.target.value)}>
                        <option value="">Selecione</option><option>Masculino</option><option>Feminino</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label>Estado civil</label>
                      <select className="input" value={f.condEstadoCivil} onChange={(e) => up("condEstadoCivil", e.target.value)}>
                        <option value="">Selecione</option>
                        <option>Casado(a)</option><option>Solteiro(a)</option><option>Viúvo(a)</option>
                        <option>Divorciado(a)</option><option>União estável</option>
                      </select>
                    </div>
                  </>
                )}
                <div className="field-group">
                  <label>Profissão</label>
                  <input className="input" value={f.profissao} onChange={(e) => up("profissao", e.target.value)} />
                </div>
                <div className="field-group">
                  <label>CEP de pernoite</label>
                  <input className="input" value={f.cepPernoite} inputMode="numeric"
                    onChange={(e) => up("cepPernoite", maskCep(e.target.value))} placeholder="00000-000" />
                </div>
                <div className="field-group full">
                  <label>Garagem</label>
                  <div className="row" style={{ gap: 18, paddingTop: 6 }}>
                    <label><input type="checkbox" checked={f.garagemResid} onChange={(e) => up("garagemResid", e.target.checked)} /> Residência</label>
                    <label><input type="checkbox" checked={f.garagemTrab} onChange={(e) => up("garagemTrab", e.target.checked)} /> Trabalho</label>
                    <label><input type="checkbox" checked={f.garagemEsc} onChange={(e) => up("garagemEsc", e.target.checked)} /> Escola/Faculdade</label>
                  </div>
                </div>
                <div className="field-group">
                  <label>Condutores entre 18-25 anos?</label>
                  <div className="row" style={{ gap: 14, paddingTop: 6 }}>
                    <label><input type="radio" name="j1825" checked={f.jovens1825 === "sim"} onChange={() => up("jovens1825", "sim")} /> Sim</label>
                    <label><input type="radio" name="j1825" checked={f.jovens1825 === "nao"} onChange={() => up("jovens1825", "nao")} /> Não</label>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2>Coberturas</h2>
              <div className="sub">Defina o tipo de cobertura, casco, franquia e adicionais.</div>
              <div className="wizard-grid">
                <div className="field-group full">
                  <label>Tipo de cobertura<span className="req">*</span></label>
                  <div className="row" style={{ gap: 8, paddingTop: 4, flexWrap: "wrap" }}>
                    {["Compreensiva", "Incêndio + Roubo", "RCF"].map((t) => (
                      <span key={t} className={"chip " + (f.tipoCobertura === t ? "chip-slate" : "chip-outline")}
                        style={{ cursor: "pointer" }} onClick={() => up("tipoCobertura", t)}>{t}</span>
                    ))}
                  </div>
                </div>
                <div className="field-group">
                  <label>Casco</label>
                  <select className="input" value={f.casco} onChange={(e) => up("casco", e.target.value)}>
                    <option>100% Tabela FIPE</option><option>95% Tabela FIPE</option><option>110% Tabela FIPE</option>
                    <option>Valor determinado</option>
                  </select>
                </div>
                {f.casco === "Valor determinado" && (
                  <div className="field-group">
                    <label>Valor determinado</label>
                    <input className="input" value={f.cascoValor}
                      onChange={(e) => up("cascoValor", maskBRL(e.target.value))} placeholder="R$ 0,00" />
                  </div>
                )}
                <div className="field-group">
                  <label>Franquia</label>
                  <select className="input" value={f.franquia} onChange={(e) => up("franquia", e.target.value)}>
                    <option>Reduzida</option><option>Normal</option><option>Majorada</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>APP — Morte</label>
                  <input className="input" value={f.appMorte}
                    onChange={(e) => up("appMorte", maskBRL(e.target.value))} placeholder="R$ 10.000,00" />
                </div>
                <div className="field-group">
                  <label>APP — Invalidez</label>
                  <input className="input" value={f.appInval}
                    onChange={(e) => up("appInval", maskBRL(e.target.value))} placeholder="R$ 10.000,00" />
                </div>
                <div className="field-group">
                  <label>DMH (despesas médicas)</label>
                  <input className="input" value={f.dmh}
                    onChange={(e) => up("dmh", maskBRL(e.target.value))} placeholder="R$ 5.000,00" />
                </div>
                <div className="field-group">
                  <label>RCF — Danos materiais</label>
                  <input className="input" value={f.rcfDm}
                    onChange={(e) => up("rcfDm", maskBRL(e.target.value))} placeholder="R$ 100.000,00" />
                </div>
                <div className="field-group">
                  <label>RCF — Danos corporais</label>
                  <input className="input" value={f.rcfDc}
                    onChange={(e) => up("rcfDc", maskBRL(e.target.value))} placeholder="R$ 100.000,00" />
                </div>
                <div className="field-group">
                  <label>Vidros</label>
                  <div className="row" style={{ gap: 14, paddingTop: 6 }}>
                    <label><input type="checkbox" checked={f.vidros} onChange={(e) => up("vidros", e.target.checked)} /> Incluir cobertura</label>
                  </div>
                </div>
                <div className="field-group">
                  <label>Carro reserva</label>
                  <select className="input" value={f.carroReserva} onChange={(e) => up("carroReserva", e.target.value)}>
                    <option>Não</option><option>7 dias</option><option>15 dias</option><option>30 dias</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Assistência 24h</label>
                  <select className="input" value={f.assist24} onChange={(e) => up("assist24", e.target.value)}>
                    <option>Básica</option><option>Intermediária</option><option>Premium</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2>Cálculo Multi-seguradora</h2>
              <div className="sub">Envie a cotação para as seguradoras configuradas e compare os prêmios.</div>
              <div style={{ padding: "12px 0" }}>
                <button className="btn btn-yellow" disabled={!podeCalcular || calculando} onClick={simularCalculo}>
                  <svg width="14" height="14"><use href="#i-bolt" /></svg>
                  {calculando ? " Calculando…" : podeCalcular ? " Calcular agora" : " Preencha os dados obrigatórios"}
                </button>
              </div>
              {resultados.length > 0 && (
                <table className="table" style={{ width: "100%", marginTop: 8 }}>
                  <thead>
                    <tr><th>Seguradora</th><th>Cobertura</th><th style={{ textAlign: "right" }}>Prêmio anual</th><th></th></tr>
                  </thead>
                  <tbody>
                    {resultados.sort((a, b) => a.premio - b.premio).map((r) => (
                      <tr key={r.cia}>
                        <td>{r.cia}</td>
                        <td>{r.cobertura}</td>
                        <td style={{ textAlign: "right" }}>R$ {r.premio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: "right" }}><button className="btn btn-ghost btn-sm">Gerar proposta</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {resultados.length === 0 && !calculando && (
                <div className="empty">Os resultados aparecerão aqui após o cálculo.</div>
              )}
            </>
          )}

          <div className="wizard-foot">
            <button className="btn btn-ghost" disabled={step === 0}
              style={step === 0 ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
              onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <svg width="14" height="14"><use href="#i-chevron-left" /></svg> Voltar
            </button>
            <span className="spacer" />
            <span className="muted small">Passo {step + 1} de {STEPS.length}</span>
            <button className="btn btn-slate" disabled={step === STEPS.length - 1}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Próximo <svg width="14" height="14"><use href="#i-chevron-right" /></svg>
            </button>
          </div>
        </div>

        <div className="resumo">
          <div className="head"><svg width="16" height="16"><use href="#i-clock" /></svg><h3>Resumo da cotação</h3></div>
          <div className="body">
            {(f.nome || f.cpf || f.marca || f.tipoCobertura) ? (
              <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                {f.nome && <div><b>Segurado:</b> {f.nome}</div>}
                {f.cpf && <div><b>{f.pessoa === "Jurídica" ? "CNPJ" : "CPF"}:</b> {f.cpf}</div>}
                {f.celular && <div><b>Celular:</b> {f.celular}</div>}
                {(f.cidade || f.uf) && <div><b>Cidade/UF:</b> {f.cidade}{f.uf ? `/${f.uf}` : ""}</div>}
                {f.tipoSeguro && <div><b>Tipo:</b> {f.tipoSeguro} · {f.ramo} · {f.categoria}</div>}
                {f.marca && <div><b>Marca:</b> {marcas.find((m) => m.codigo === f.marca)?.nome || f.marca}</div>}
                {f.modelo && <div><b>Modelo:</b> {modelos.find((m) => String(m.codigo) === f.modelo)?.nome || f.modelo}</div>}
                {f.anoModelo && <div><b>Ano:</b> {f.anoModelo}{f.anoFab ? `/${f.anoFab}` : ""}</div>}
                {fipeValor && <div><b>FIPE:</b> {fipeValor}</div>}
                {f.tipoCobertura && <div><b>Cobertura:</b> {f.tipoCobertura} · Franquia {f.franquia}</div>}
              </div>
            ) : (
              <div className="empty">Conforme você preenche, o resumo aparece aqui.</div>
            )}
          </div>
          <div className="insurers-row">
            <span className="ins-chip"><svg width="12" height="12"><use href="#i-shield" /></svg> {SEGURADORAS.length} seguradoras no cálculo</span>
          </div>
          <div className="footer">
            <button className="btn btn-yellow" disabled={!podeCalcular}
              style={!podeCalcular ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              onClick={() => { setStep(5); simularCalculo(); }}>
              <svg width="14" height="14"><use href="#i-bolt" /></svg> Calcular
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => void persistir()} disabled={saveState === "saving"}>
              <svg width="13" height="13"><use href="#i-download" /></svg>
              {saveState === "saving" ? " Salvando…" : " Salvar rascunho"}
            </button>
            <div className="muted small" style={{ marginTop: 6 }}>
              {saveState === "saving" && "Salvando…"}
              {saveState === "saved" && lastSavedAt && `Salvo às ${lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
              {saveState === "error" && <span style={{ color: "#dc2626" }}>Erro ao salvar — tente novamente</span>}
              {cotacaoId && <div style={{ fontSize: 11, opacity: 0.6 }}>ID: {cotacaoId.slice(0, 8)}…</div>}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
