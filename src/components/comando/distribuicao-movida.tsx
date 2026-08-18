import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database.types";
import {
  aliasMovidaSchema,
  lojaMovidaSchema,
  membroPoolMovidaSchema,
  normalizarChaveLojaMovida,
  somarPendenciasAliasesMovida,
  type LojaMovidaForm,
  type MembroPoolMovidaForm,
} from "@/lib/distribuicao-movida";

type Loja = Tables<"movida_lojas">;
type Alias = Tables<"movida_loja_aliases">;
type Membro = Tables<"movida_loja_vendedores">;
type Empresa = Pick<Tables<"empresas">, "id" | "nome">;
type Vendedor = Pick<Tables<"profiles">, "id" | "nome" | "empresa_id">;

const queryKey = ["distribuicao-movida"] as const;
// O gerador do Supabase tipa argumentos UUID de RPC como `string`, embora a
// função use NULL para distinguir criação de edição.
const NOVA_ROTA_ID = null as unknown as string;

export function DistribuicaoMovida({ podeEditar }: { podeEditar: boolean }) {
  const queryClient = useQueryClient();
  const [lojaId, setLojaId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novoAlias, setNovoAlias] = useState("");

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const [lojas, aliases, membros, empresas, profiles, roles, pendentes] = await Promise.all([
        supabase.from("movida_lojas").select("*").order("nome"),
        supabase.from("movida_loja_aliases").select("*").order("alias"),
        supabase.from("movida_loja_vendedores").select("*").order("criado_em"),
        supabase
          .from("empresas")
          .select("id,nome,modelo_id,modelos_franquia(modalidade)")
          .eq("status", "aprovada")
          .order("nome"),
        supabase
          .from("profiles")
          .select("id,nome,empresa_id")
          .eq("status", "aprovada")
          .order("nome"),
        // "vendedor" cobre o time interno/CLT; franqueado individual (PJ que
        // opera sozinho como um vendedor único, sem equipe — modalidade
        // 'individual') também pode entrar no pool de uma loja Movida, desde
        // que a loja seja da empresa dele mesmo. Franquia Full não entra aqui
        // (ela tem vendedores próprios, que é quem participaria do pool).
        supabase.from("user_roles").select("user_id,role").in("role", ["vendedor", "franqueado"]),
        supabase
          .from("leads")
          .select("dados")
          .eq("origem", "captacao_movida")
          .eq("status_pipeline", "novo")
          .is("empresa_id", null)
          .is("responsavel_id", null)
          .eq("arquivado", false)
          .eq("bloqueado", false)
          .eq("em_avaliacao_matriz", false),
      ]);
      const falha = [lojas, aliases, membros, empresas, profiles, roles, pendentes].find(
        (resultado) => resultado.error,
      );
      if (falha?.error) throw falha.error;
      const empresasData = (empresas.data ?? []) as Array<{
        id: string;
        nome: string;
        modelo_id: string | null;
        modelos_franquia: { modalidade: string } | { modalidade: string }[] | null;
      }>;
      const empresasIndividuais = new Set(
        empresasData
          .filter((empresa) => {
            const modelo = Array.isArray(empresa.modelos_franquia)
              ? empresa.modelos_franquia[0]
              : empresa.modelos_franquia;
            return modelo?.modalidade === "individual";
          })
          .map((empresa) => empresa.id),
      );
      const rolesData = (roles.data ?? []) as { user_id: string; role: string }[];
      const vendedoresIds = new Set(
        rolesData.filter((role) => role.role === "vendedor").map((role) => role.user_id),
      );
      const franqueadosIds = new Set(
        rolesData.filter((role) => role.role === "franqueado").map((role) => role.user_id),
      );
      return {
        lojas: (lojas.data ?? []) as Loja[],
        aliases: (aliases.data ?? []) as Alias[],
        membros: (membros.data ?? []) as Membro[],
        empresas: empresasData as Empresa[],
        vendedores: (profiles.data ?? []).filter((profile) => {
          if (vendedoresIds.has(profile.id)) return true;
          return (
            franqueadosIds.has(profile.id) &&
            !!profile.empresa_id &&
            empresasIndividuais.has(profile.empresa_id)
          );
        }) as Vendedor[],
        pendentes: (pendentes.data ?? []).map((lead) => {
          const dados = lead.dados as { loja?: string } | null;
          return normalizarChaveLojaMovida(dados?.loja ?? "");
        }),
      };
    },
  });

  const lojaForm = useForm<LojaMovidaForm>({
    resolver: zodResolver(lojaMovidaSchema),
    defaultValues: { nome: "", alias: "", empresaId: "", ativa: true, exigirOnline: false },
  });
  const membroForm = useForm<MembroPoolMovidaForm>({
    resolver: zodResolver(membroPoolMovidaSchema),
    defaultValues: { vendedorId: "", peso: 1, limiteDiario: null, ativo: true },
  });
  const ultimaRotaHidratada = useRef<string | null>(null);
  const resetLojaForm = lojaForm.reset;
  const resetMembroForm = membroForm.reset;

  const lojaSelecionada = query.data?.lojas.find((loja) => loja.id === lojaId) ?? null;
  const aliasSelecionado = query.data?.aliases.find((alias) => alias.loja_id === lojaId) ?? null;
  const aliasesSelecionados = query.data?.aliases.filter((alias) => alias.loja_id === lojaId) ?? [];
  const lojaSelecionadaId = lojaSelecionada?.id;
  const lojaSelecionadaNome = lojaSelecionada?.nome;
  const lojaSelecionadaEmpresaId = lojaSelecionada?.empresa_id;
  const lojaSelecionadaAtiva = lojaSelecionada?.ativa;
  const lojaSelecionadaExigirOnline = lojaSelecionada?.exigir_online;
  const aliasSelecionadoId = aliasSelecionado?.id;
  const aliasSelecionadoValor = aliasSelecionado?.alias;
  const pool = query.data?.membros.filter((membro) => membro.loja_id === lojaId) ?? [];
  const vendedoresDaEmpresa =
    query.data?.vendedores.filter(
      (vendedor) => vendedor.empresa_id === lojaSelecionada?.empresa_id,
    ) ?? [];

  useEffect(() => {
    if (
      !lojaSelecionadaId ||
      !lojaSelecionadaNome ||
      !lojaSelecionadaEmpresaId ||
      lojaSelecionadaAtiva === undefined ||
      lojaSelecionadaExigirOnline === undefined
    )
      return;
    const chaveRota = `${lojaSelecionadaId}:${aliasSelecionadoId ?? ""}:${aliasSelecionadoValor ?? ""}`;
    if (ultimaRotaHidratada.current === chaveRota) return;
    ultimaRotaHidratada.current = chaveRota;
    resetLojaForm({
      nome: lojaSelecionadaNome,
      alias: aliasSelecionadoValor ?? "",
      empresaId: lojaSelecionadaEmpresaId,
      ativa: lojaSelecionadaAtiva,
      exigirOnline: lojaSelecionadaExigirOnline,
    });
    resetMembroForm({ vendedorId: "", peso: 1, limiteDiario: null, ativo: true });
  }, [
    aliasSelecionadoId,
    aliasSelecionadoValor,
    lojaSelecionadaAtiva,
    lojaSelecionadaEmpresaId,
    lojaSelecionadaExigirOnline,
    lojaSelecionadaId,
    lojaSelecionadaNome,
    resetLojaForm,
    resetMembroForm,
  ]);

  const pendentesPorLoja = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const alias of query.data?.pendentes ?? []) {
      contagem.set(alias, (contagem.get(alias) ?? 0) + 1);
    }
    return contagem;
  }, [query.data?.pendentes]);

  const criarOuSalvar = useMutation({
    mutationFn: async (form: LojaMovidaForm) => {
      if (lojaSelecionada) {
        const { error } = await supabase
          .from("movida_lojas")
          .update({
            nome: form.nome,
            empresa_id: form.empresaId,
            ativa: form.ativa,
            exigir_online: form.exigirOnline,
          })
          .eq("id", lojaSelecionada.id);
        if (error) throw error;
        return lojaSelecionada.id;
      }
      const { data: lojaIdCriada, error } = await supabase.rpc("fn_salvar_rota_movida", {
        p_loja_id: NOVA_ROTA_ID,
        p_nome: form.nome,
        p_alias: form.alias,
        p_empresa_id: form.empresaId,
        p_ativa: form.ativa,
        p_exigir_online: form.exigirOnline,
      });
      if (error) throw error;
      return lojaIdCriada;
    },
    onSuccess: async (id) => {
      setErro(null);
      setFeedback(lojaSelecionada ? "Rota Movida atualizada." : "Rota Movida criada.");
      setLojaId(id);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      setFeedback(null);
      setErro(error.message);
    },
  });

  const adicionarMembro = useMutation({
    mutationFn: async (form: MembroPoolMovidaForm) => {
      if (!lojaSelecionada) throw new Error("Selecione uma loja.");
      const { error } = await supabase.from("movida_loja_vendedores").insert({
        loja_id: lojaSelecionada.id,
        vendedor_id: form.vendedorId,
        peso: form.peso,
        limite_diario: form.limiteDiario,
        ativo: form.ativo,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setErro(null);
      setFeedback("Vendedor adicionado ao pool.");
      membroForm.reset({ vendedorId: "", peso: 1, limiteDiario: null, ativo: true });
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => setErro(error.message),
  });

  const atualizarMembro = useMutation({
    mutationFn: async (membro: Membro) => {
      const { error } = await supabase
        .from("movida_loja_vendedores")
        .update({ ativo: !membro.ativo })
        .eq("loja_id", membro.loja_id)
        .eq("vendedor_id", membro.vendedor_id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error: Error) => setErro(error.message),
  });

  const removerMembro = useMutation({
    mutationFn: async (membro: Membro) => {
      const { error } = await supabase
        .from("movida_loja_vendedores")
        .delete()
        .eq("loja_id", membro.loja_id)
        .eq("vendedor_id", membro.vendedor_id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error: Error) => setErro(error.message),
  });

  const adicionarAlias = useMutation({
    mutationFn: async (alias: string) => {
      if (!lojaSelecionada) throw new Error("Selecione uma loja.");
      const valor = aliasMovidaSchema.parse(alias);
      const { error } = await supabase
        .from("movida_loja_aliases")
        .insert({ loja_id: lojaSelecionada.id, alias: valor });
      if (error) throw error;
    },
    onSuccess: async () => {
      setErro(null);
      setFeedback("Alias adicionado à rota.");
      setNovoAlias("");
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => setErro(error.message),
  });

  const removerAlias = useMutation({
    mutationFn: async (alias: Alias) => {
      if (!confirm(`Remover o alias “${alias.alias}” desta rota?`)) return false;
      const { error } = await supabase.from("movida_loja_aliases").delete().eq("id", alias.id);
      if (error) throw error;
      return true;
    },
    onSuccess: async (removeu) => {
      if (!removeu) return;
      setErro(null);
      setFeedback("Alias removido da rota.");
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => setErro(error.message),
  });

  const reprocessar = useMutation({
    mutationFn: async (loja: Loja) => {
      if (!confirm(`Reprocessar agora os leads pendentes de ${loja.nome}?`)) return null;
      const { data, error } = await supabase.rpc("reprocessar_leads_movida_pendentes", {
        p_loja_id: loja.id,
        p_limite: 500,
      });
      if (error) throw error;
      return data[0] ?? { processados: 0, distribuidos: 0, pendentes: 0 };
    },
    onSuccess: async (resultado) => {
      if (!resultado) return;
      setErro(null);
      setFeedback(
        `${resultado.distribuidos} de ${resultado.processados} lead(s) distribuído(s); ${resultado.pendentes} permaneceram na Fila Global.`,
      );
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => setErro(error.message),
  });

  function novaLoja() {
    ultimaRotaHidratada.current = null;
    setLojaId(null);
    setErro(null);
    setFeedback(null);
    lojaForm.reset({ nome: "", alias: "", empresaId: "", ativa: true, exigirOnline: false });
  }

  const campoErro = Object.values(lojaForm.formState.errors)[0]?.message;
  const membroErro = Object.values(membroForm.formState.errors)[0]?.message;

  return (
    <div className="card acc-sec-t" data-tour="distribuicao-movida">
      <div className="card-h">
        <h3>
          <svg width="16" height="16">
            <use href="#i-building"></use>
          </svg>{" "}
          Captação Movida por loja
        </h3>
        {podeEditar && (
          <button className="btn btn-yellow btn-sm" type="button" onClick={novaLoja}>
            <svg width="13" height="13">
              <use href="#i-plus"></use>
            </svg>{" "}
            Nova rota
          </button>
        )}
      </div>
      <div className="card-b">
        <div className="field-group">
          <div className="audit-note">
            <svg width="16" height="16">
              <use href="#i-info"></use>
            </svg>{" "}
            Cada loja aponta para uma empresa e para seu pool de vendedores. Um pool com apenas um
            vendedor é válido. Sem vendedor elegível, o lead permanece na{" "}
            <strong>Fila Global</strong>.
          </div>
        </div>
        {(erro ?? campoErro ?? membroErro ?? query.error?.message) && (
          <div className="field-group">
            <div className="chip chip-alert">
              {erro ?? campoErro ?? membroErro ?? query.error?.message}
            </div>
          </div>
        )}
        {feedback && !erro && (
          <div className="field-group">
            <div className="chip chip-ok">{feedback}</div>
          </div>
        )}
        <div className="detail-grid">
          <div>
            <div className="field-group">
              <div className="row">
                <strong>Rotas configuradas</strong>
                <span className="spacer"></span>
                <span className="small muted">{query.data?.lojas.length ?? 0} loja(s)</span>
              </div>
            </div>
            <div className="crit-list">
              {(query.data?.lojas ?? []).map((loja) => {
                const aliasesRota =
                  query.data?.aliases.filter((item) => item.loja_id === loja.id) ?? [];
                const membros =
                  query.data?.membros.filter((item) => item.loja_id === loja.id) ?? [];
                const pendentes = somarPendenciasAliasesMovida(
                  aliasesRota.map((alias) => alias.alias_normalizado),
                  pendentesPorLoja,
                );
                return (
                  <button
                    type="button"
                    key={loja.id}
                    className={`mode-card ${loja.id === lojaId ? "on" : ""}`}
                    onClick={() => setLojaId(loja.id)}
                  >
                    <div className="mc-ic">
                      <svg width="18" height="18">
                        <use href="#i-pin"></use>
                      </svg>
                    </div>
                    <div>
                      <div className="mc-t">{loja.nome}</div>
                      <div className="mc-d">
                        {aliasesRota.length ? `${aliasesRota.length} alias(es)` : "sem chave"} ·{" "}
                        {membros.length} no pool · {pendentes} pendente(s)
                      </div>
                    </div>
                    <span className={`chip ${loja.ativa ? "chip-ok" : "chip-slate"}`}>
                      {loja.ativa ? "ativa" : "pausada"}
                    </span>
                  </button>
                );
              })}
            </div>
            {!query.isLoading && !query.data?.lojas.length && (
              <p className="muted small">Nenhuma rota Movida configurada.</p>
            )}
          </div>

          <form onSubmit={lojaForm.handleSubmit((form) => criarOuSalvar.mutate(form))}>
            <div className="field-group">
              <label>Nome exibido da loja</label>
              <input
                className="input"
                maxLength={120}
                disabled={!podeEditar}
                {...lojaForm.register("nome")}
              />
            </div>
            <div className="field-group">
              <label>
                {lojaSelecionada ? "Aliases recebidos da Movida" : "Alias inicial da Movida"}
              </label>
              <input
                className="input"
                maxLength={160}
                disabled={!podeEditar || !!lojaSelecionada}
                {...lojaForm.register("alias")}
              />
              {lojaSelecionada && (
                <div className="crit-list">
                  {aliasesSelecionados.map((alias) => (
                    <div className="crit-row" key={alias.id}>
                      <div className="cr-body">
                        <div className="cr-t">{alias.alias}</div>
                        <div className="cr-d">Chave normalizada: {alias.alias_normalizado}</div>
                      </div>
                      {podeEditar && (
                        <button
                          className="ic-mini"
                          type="button"
                          title={`Remover alias ${alias.alias}`}
                          disabled={removerAlias.isPending}
                          onClick={() => removerAlias.mutate(alias)}
                        >
                          <svg width="14" height="14">
                            <use href="#i-trash"></use>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {podeEditar && (
                    <div className="input-row">
                      <input
                        className="input"
                        aria-label="Novo alias da loja"
                        maxLength={160}
                        placeholder="Novo alias"
                        value={novoAlias}
                        onChange={(event) => setNovoAlias(event.target.value)}
                      />
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        disabled={adicionarAlias.isPending || !novoAlias.trim()}
                        onClick={() => adicionarAlias.mutate(novoAlias)}
                      >
                        Adicionar alias
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="field-group">
              <label>Empresa destino</label>
              <select
                className="input"
                disabled={!podeEditar || (!!lojaSelecionada && pool.length > 0)}
                {...lojaForm.register("empresaId")}
              >
                <option value="">Selecione…</option>
                {(query.data?.empresas ?? []).map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nome}
                  </option>
                ))}
              </select>
              {!!lojaSelecionada && pool.length > 0 && (
                <div className="small muted">Remova o pool antes de trocar a empresa.</div>
              )}
            </div>
            <div className="crit-list">
              <label className="crit-row">
                <div className="cr-body">
                  <div className="cr-t">Rota ativa</div>
                  <div className="cr-d">Aplica o pool aos novos leads desta loja</div>
                </div>
                <input type="checkbox" disabled={!podeEditar} {...lojaForm.register("ativa")} />
              </label>
              <label className="crit-row">
                <div className="cr-body">
                  <div className="cr-t">Exigir vendedor online</div>
                  <div className="cr-d">Sem ninguém online, mantém o lead na Fila Global</div>
                </div>
                <input
                  type="checkbox"
                  disabled={!podeEditar}
                  {...lojaForm.register("exigirOnline")}
                />
              </label>
            </div>
            {podeEditar && (
              <div className="acc-sec-t">
                <button className="btn btn-yellow" type="submit" disabled={criarOuSalvar.isPending}>
                  {lojaSelecionada ? "Salvar rota" : "Criar rota"}
                </button>
              </div>
            )}
          </form>
        </div>

        {lojaSelecionada && (
          <div className="card acc-sec-t">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-users"></use>
                </svg>{" "}
                Pool de vendedores
              </h3>
              <button
                className="btn btn-slate btn-sm"
                type="button"
                disabled={!podeEditar || reprocessar.isPending}
                onClick={() => reprocessar.mutate(lojaSelecionada)}
              >
                <svg width="13" height="13">
                  <use href="#i-refresh"></use>
                </svg>{" "}
                Reprocessar pendentes
              </button>
            </div>
            <div className="card-b">
              {pool.map((membro) => {
                const vendedor = query.data?.vendedores.find(
                  (item) => item.id === membro.vendedor_id,
                );
                return (
                  <div className="crit-row" key={membro.vendedor_id}>
                    <div className="cr-body">
                      <div className="cr-t">{vendedor?.nome ?? "Vendedor indisponível"}</div>
                      <div className="cr-d">
                        Peso {membro.peso} · limite diário {membro.limite_diario ?? "sem limite"}
                      </div>
                    </div>
                    <span className={`chip ${membro.ativo ? "chip-ok" : "chip-slate"}`}>
                      {membro.ativo ? "ativo" : "pausado"}
                    </span>
                    {podeEditar && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => atualizarMembro.mutate(membro)}
                      >
                        {membro.ativo ? "Pausar" : "Ativar"}
                      </button>
                    )}
                    {podeEditar && (
                      <button
                        type="button"
                        className="ic-mini"
                        title="Remover do pool"
                        onClick={() => removerMembro.mutate(membro)}
                      >
                        <svg width="14" height="14">
                          <use href="#i-trash"></use>
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
              {!pool.length && (
                <p className="muted small">
                  Pool vazio. Adicione ao menos um vendedor para distribuir.
                </p>
              )}
              {podeEditar && (
                <form
                  className="acc-grid acc-grid-4"
                  onSubmit={membroForm.handleSubmit((form) => adicionarMembro.mutate(form))}
                >
                  <div className="field-group">
                    <label>Vendedor</label>
                    <select className="input" {...membroForm.register("vendedorId")}>
                      <option value="">Selecione…</option>
                      {vendedoresDaEmpresa
                        .filter(
                          (vendedor) => !pool.some((membro) => membro.vendedor_id === vendedor.id),
                        )
                        .map((vendedor) => (
                          <option key={vendedor.id} value={vendedor.id}>
                            {vendedor.nome}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label>Peso</label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={100}
                      {...membroForm.register("peso")}
                    />
                  </div>
                  <div className="field-group">
                    <label>Limite diário</label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      placeholder="Sem limite"
                      {...membroForm.register("limiteDiario", {
                        setValueAs: (value) => (value === "" ? null : Number(value)),
                      })}
                    />
                  </div>
                  <button
                    className="btn btn-yellow"
                    type="submit"
                    disabled={adicionarMembro.isPending}
                  >
                    Adicionar
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
