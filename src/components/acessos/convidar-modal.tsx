import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAreas } from "@/lib/use-areas";
import { Icon } from "@/components/operacao/acessos/icon";
import { baixarConvitePdf, type ConvitePdfDados } from "@/lib/convite-pdf";
import logoUrl from "@/assets/cotecerto-logo.png";

/**
 * Modal do Convite Supper (V11 · C4/C5).
 *
 * Um componente por escopo (`openConvite(scope)` do protótipo r40). O escopo
 * recorta as opções aqui, mas **a decisão é do servidor**: `criar_convite` valida
 * o perfil de quem chama e força o vínculo de Master e Full neles. Se esta tela
 * mandar algo fora do escopo, a RPC recusa — o recorte visual é conveniência,
 * não a guarda.
 */

export type EscopoConvite = "interno" | "externo" | "master" | "full";

type Cargo = { id: string; nome: string };
type Franquia = { id: string; nome: string };

/** Opções de perfil por escopo, na ordem do protótipo. */
type OpcaoPerfil = {
  valor: string;
  label: string;
  /** Payload enviado à RPC. */
  perfil: string | null;
  cargoId?: string | null;
  vincTipo?: "matriz" | "master" | "full";
  /** Pede o seletor de Franquia Full. */
  pedeFull?: boolean;
};

const OPCOES_EXTERNO: OpcaoPerfil[] = [
  { valor: "master", label: "Master", perfil: "master" },
  { valor: "franquia_indiv", label: "Franquia Individual · direta", perfil: "franquia_indiv" },
];

const OPCOES_MASTER: OpcaoPerfil[] = [
  { valor: "franquia_full", label: "Franquia Full", perfil: "franquia_full" },
  { valor: "franquia_indiv", label: "Franquia Individual", perfil: "franquia_indiv" },
  { valor: "vendedor_master", label: "Vendedor · da minha operação", perfil: "vendedor" },
  {
    valor: "vendedor_full",
    label: "Vendedor · de uma Franquia Full",
    perfil: "vendedor",
    vincTipo: "full",
    pedeFull: true,
  },
];

const OPCOES_FULL: OpcaoPerfil[] = [
  { valor: "vendedor_full", label: "Vendedor | Full — da minha franquia", perfil: "vendedor" },
];

const TITULO: Record<EscopoConvite, string> = {
  interno: "Convite Supper · time interno da Matriz",
  externo: "Convite Supper · rede externa",
  master: "Convite Supper · minha rede",
  full: "Convite Supper · meu time",
};

/** Rótulo do tipo declarado, no formato "TÍTULO | qualificador" do protótipo. */
function rotuloDeclarado(op: OpcaoPerfil, cargoNome?: string): string {
  if (op.cargoId) return `Matriz | ${cargoNome ?? op.label}`;
  if (op.perfil === null) return "Matriz | Vendedor Matriz (Modelo CLT)";
  switch (op.perfil) {
    case "master":
      return "Master | franqueado";
    case "franquia_full":
      return "Franquia | Full";
    case "franquia_indiv":
      return "Franquia | Individual";
    case "vendedor":
      return op.vincTipo === "full" ? "Vendedor | Full" : "Vendedor | Master";
    default:
      return op.label;
  }
}

/**
 * Pré-visualização inline da arte do PDF (V11 · C6b) — espelha o `cvArteHTML`
 * compacto do protótipo r40 (mesmo card, mesma paleta), mas em JSX/CSS em vez
 * de HTML injetado num iframe. Reaproveita as mesmas cores de `convite-pdf.ts`.
 */
function ConvitePreview({ d }: { d: ConvitePdfDados }) {
  return (
    <div
      style={{
        border: "1px solid var(--border-soft)",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--white)",
      }}
    >
      <div
        style={{
          background: "var(--slate)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <img src={logoUrl} alt="" style={{ height: 22 }} />
        <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>
          CONVITE <span style={{ color: "var(--yellow)" }}>SUPPER</span>
        </div>
      </div>

      <div style={{ padding: 18, fontSize: 12.5, color: "var(--ink)", lineHeight: 1.5 }}>
        <p style={{ margin: "0 0 10px" }}>
          Olá, {d.nome}! Aqui é {d.quem}, {d.cargo} da Supper Certo.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          Quero te convidar para se cadastrar na nossa plataforma como
        </p>
        <span
          style={{
            display: "inline-block",
            background: "var(--yellow)",
            color: "var(--slate-dark)",
            fontWeight: 700,
            fontSize: 11.5,
            borderRadius: 999,
            padding: "5px 12px",
            marginBottom: 14,
          }}
        >
          {d.perfil}
        </span>

        <div
          style={{
            background: "#F7F8F8",
            borderLeft: "3px solid var(--yellow)",
            padding: "10px 12px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 9,
              color: "var(--muted)",
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            COMO FUNCIONA
          </div>
          <div style={{ fontSize: 11 }}>
            1. Toque no link — o cadastro abre já identificado com o seu convite.
            <br />
            2. Confira seus dados e confirme o vínculo (ele já vem preenchido).
            <br />
            3. Envie — seu pedido entra na fila de aprovação e a confirmação chega no seu e-mail.
          </div>
        </div>

        <div
          style={{
            background: "var(--cream)",
            borderRadius: 6,
            padding: "10px 12px",
            marginBottom: 14,
            fontFamily: "monospace",
            fontSize: 10.5,
            color: "#8A6400",
            wordBreak: "break-all",
          }}
        >
          {d.link}
        </div>

        <div
          style={{
            borderTop: "1px solid var(--border-soft)",
            paddingTop: 10,
            fontSize: 9.5,
            color: "var(--muted)",
          }}
        >
          Este convite é nominal e de uso único ({d.codigo}) — vale só para você, por 7 dias. Se
          expirar, é só pedir um novo a quem te enviou.
        </div>
      </div>

      <div
        style={{
          background: "var(--slate-dark)",
          textAlign: "center",
          padding: "7px 0",
          fontSize: 9.5,
          color: "#C7D0D6",
        }}
      >
        SUPPER CERTO · PLATAFORMA COTE CERTO
      </div>
    </div>
  );
}

export function ConvidarModal({ escopo, onClose }: { escopo: EscopoConvite; onClose: () => void }) {
  const { profile, role } = useAuth();
  const { cargoNome } = useAreas();

  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [fulls, setFulls] = useState<Franquia[]>([]);
  const [nome, setNome] = useState("");
  const [opcaoSel, setOpcaoSel] = useState("");
  const [fullSel, setFullSel] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [codigo, setCodigo] = useState<string | null>(null);
  // Guardado para o PDF, que reaproveita exatamente o que foi gerado.
  const [dadosPdf, setDadosPdf] = useState<ConvitePdfDados | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (escopo !== "interno") return;
    supabase
      .from("cargos")
      .select("id,nome")
      .order("nome")
      .then(({ data }) => setCargos((data as Cargo[]) ?? []));
  }, [escopo]);

  useEffect(() => {
    if (escopo !== "master") return;
    // Franquias Full da rede visível — o servidor confere de novo.
    supabase
      .from("empresas")
      .select("id,nome,modelo_id,modelos_franquia(modalidade)")
      .eq("status", "aprovada")
      .then(({ data }) => {
        const lista = (
          (data ?? []) as Array<Franquia & { modelos_franquia?: { modalidade?: string } | null }>
        )
          .filter((e) => e.modelos_franquia?.modalidade === "full")
          .map((e) => ({ id: e.id, nome: e.nome }));
        setFulls(lista);
      });
  }, [escopo]);

  const opcoes: OpcaoPerfil[] = useMemo(() => {
    if (escopo === "interno") {
      return [
        ...cargos.map((c) => ({
          valor: `cargo:${c.id}`,
          label: `Matriz · ${c.nome}`,
          perfil: null,
          cargoId: c.id,
        })),
        {
          valor: "vend_matriz",
          label: "Matriz · Vendedor Matriz (Modelo CLT)",
          perfil: "vendedor",
        },
      ];
    }
    if (escopo === "externo") return OPCOES_EXTERNO;
    if (escopo === "master") return OPCOES_MASTER;
    return OPCOES_FULL;
  }, [escopo, cargos]);

  // No escopo da Full só existe uma opção: já vem escolhida.
  useEffect(() => {
    if (escopo === "full") setOpcaoSel("vendedor_full");
  }, [escopo]);

  const opcao = opcoes.find((o) => o.valor === opcaoSel);
  const precisaFull = !!opcao?.pedeFull;

  async function gerar() {
    setErro(null);
    setAviso(null);
    if (!nome.trim()) {
      setErro("Diga o nome de quem você vai convidar — o convite é nominal.");
      return;
    }
    if (!opcao) {
      setErro("Escolha o perfil do convite.");
      return;
    }
    if (precisaFull && !fullSel) {
      setErro("Escolha de qual Franquia Full é o vendedor.");
      return;
    }

    setGerando(true);
    const { data, error } = await supabase.rpc("criar_convite", {
      p_nome: nome.trim(),
      p_escopo: escopo,
      p_trilha: escopo === "interno" ? "interno" : "externo",
      p_perfil: (opcao.cargoId ? null : opcao.perfil) ?? undefined,
      p_cargo_id: opcao.cargoId ?? undefined,
      p_vinc_tipo:
        opcao.vincTipo ?? (escopo === "interno" || escopo === "externo" ? "matriz" : "master"),
      p_vinc_empresa_id: precisaFull ? fullSel : undefined,
      p_validade_dias: 7,
    });
    setGerando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    const emitido = (data as unknown as Array<{ codigo: string; token: string }>)[0];
    if (!emitido) {
      setErro("Não foi possível emitir o convite.");
      return;
    }

    // O link usa a origem atual para funcionar em dev, staging e produção.
    const link = `${window.location.origin}/convite/${emitido.token}`;
    const quem = profile?.nome ?? "Equipe Supper";
    // O cargo de quem convida entra na saudação ("Aqui é Fulana, <cargo> da
    // Supper Certo"). Sem cargo definido o fallback tem de ser um cargo, nunca o
    // nome da empresa — senão sai "Supper Certo da Supper Certo".
    const meuCargo =
      cargoNome ??
      (role === "master" ? "Master franqueado" : role === "franqueado" ? "Franquia" : "Matriz");
    const declarado = rotuloDeclarado(
      opcao,
      opcao.cargoId ? cargos.find((c) => c.id === opcao.cargoId)?.nome : undefined,
    );

    setCodigo(emitido.codigo);
    setDadosPdf({
      nome: nome.trim(),
      perfil: declarado,
      quem,
      cargo: meuCargo,
      link,
      codigo: emitido.codigo,
    });
    setMensagem(
      `Olá, ${nome.trim()}! Aqui é ${quem}, ${meuCargo} da Supper Certo.\n\n` +
        `Quero te convidar para se cadastrar na nossa plataforma como *${declarado}*. É rápido:\n` +
        `1. Toque no link — o cadastro abre já identificado com o seu convite.\n` +
        `2. Confira seus dados e confirme o vínculo (ele já vem preenchido).\n` +
        `3. Envie — seu pedido entra na fila de aprovação e a confirmação chega no seu e-mail.\n\n` +
        `${link}\n\n` +
        `Este convite é nominal e de uso único — vale só para você, por 7 dias. ` +
        `Se expirar, é só me pedir um novo.`,
    );
  }

  async function copiar() {
    if (!mensagem) return;
    try {
      await navigator.clipboard.writeText(mensagem);
      setAviso("Mensagem copiada — é só colar na conversa.");
    } catch {
      setAviso("Não conseguimos copiar automaticamente. Selecione o texto e copie.");
    }
  }

  async function baixarPdf() {
    if (!dadosPdf) return;
    setBaixando(true);
    setAviso(null);
    try {
      await baixarConvitePdf(dadosPdf);
      setAviso("PDF baixado — anexe na conversa do WhatsApp.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar o PDF.");
    } finally {
      setBaixando(false);
    }
  }

  function enviarWhatsApp() {
    if (!mensagem) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener");
    setAviso("Abrindo o WhatsApp — escolha o contato na sua lista.");
  }

  return (
    <div
      className="modal-host"
      role="dialog"
      aria-modal="true"
      aria-label={TITULO[escopo]}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-h">
          <h3>{TITULO[escopo]}</h3>
          <div className="x" onClick={onClose} role="button" aria-label="Fechar">
            <Icon id="x" size={18} />
          </div>
        </div>

        <div className="modal-b">
          <div className="acc-grid">
            <div className="field-group full">
              <label htmlFor="cv-nome">Nome de quem você vai convidar</label>
              <input
                id="cv-nome"
                className="input"
                value={nome}
                maxLength={120}
                placeholder="Nome do candidato"
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            {escopo !== "full" && (
              <div className="field-group full">
                <label htmlFor="cv-perfil">Perfil do convite</label>
                <select
                  id="cv-perfil"
                  className="input"
                  value={opcaoSel}
                  onChange={(e) => {
                    setOpcaoSel(e.target.value);
                    setMensagem("");
                    setCodigo(null);
                    setDadosPdf(null);
                  }}
                >
                  <option value="">Selecione…</option>
                  {opcoes.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {escopo === "full" && (
              <div className="field-group full">
                <label>Perfil do convite — fixo</label>
                <div className="clt-note" style={{ margin: 0 }}>
                  <div>
                    <strong>Vendedor | Full</strong> — da sua franquia. É o único perfil que a
                    franquia convida, e o vínculo é sempre você.
                  </div>
                </div>
              </div>
            )}

            {precisaFull && (
              <div className="field-group full">
                <label htmlFor="cv-full">De qual Franquia Full?</label>
                <select
                  id="cv-full"
                  className="input"
                  value={fullSel}
                  onChange={(e) => setFullSel(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {fulls.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="btn btn-slate" type="button" onClick={gerar} disabled={gerando}>
              {gerando ? "Gerando…" : "Gerar mensagem"}
            </button>
          </div>

          {erro && (
            <div className="banner alert" style={{ marginTop: 12 }}>
              {erro}
            </div>
          )}

          {mensagem && (
            <div className="field-group full" style={{ marginTop: 12 }}>
              <label style={{ display: "flex", alignItems: "center" }}>
                Mensagem pronta (WhatsApp){" "}
                {codigo && <span className="muted">&nbsp;· {codigo}</span>}
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  style={{ marginLeft: "auto" }}
                  onClick={copiar}
                >
                  Copiar
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  style={{ marginLeft: 6 }}
                  onClick={baixarPdf}
                  disabled={baixando}
                  data-testid="convite-pdf"
                >
                  {baixando ? "Gerando…" : "Baixar em PDF"}
                </button>
              </label>
              <textarea
                className="input"
                rows={9}
                readOnly
                value={mensagem}
                data-testid="convite-mensagem"
                style={{ fontSize: 12.5, lineHeight: 1.5 }}
              />
            </div>
          )}

          {dadosPdf && (
            <div className="field-group full" style={{ marginTop: 12 }}>
              <label>Pré-visualização do convite (PDF)</label>
              <ConvitePreview d={dadosPdf} />
            </div>
          )}

          {aviso && (
            <div className="clt-note" style={{ marginTop: 10 }}>
              <div>{aviso}</div>
            </div>
          )}

          <div className="clt-note" style={{ marginTop: 10 }}>
            <div>
              O link é <strong>nominal e de uso único</strong>: abre o cadastro com perfil e vínculo
              já preenchidos. Para o <strong>Enviar por WhatsApp</strong>, o contato já precisa
              estar salvo na sua lista — a mensagem abre pronta, é só escolher a pessoa. Contato não
              salvo? Use o <strong>Copiar</strong>.
            </div>
          </div>
        </div>

        <div className="modal-f">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Fechar
          </button>
          <button
            className="btn btn-yellow"
            type="button"
            onClick={enviarWhatsApp}
            disabled={!mensagem}
          >
            Enviar por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
