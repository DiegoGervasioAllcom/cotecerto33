import { beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  criarEmpresa,
  criarPersonaComEmpresa,
  criarUsuario,
  loginMatriz,
  uniq,
  type Db,
} from "../helpers/supabase";

describe("V11.5c — Franquia Full exige Master e governa somente o próprio time", () => {
  let full: Db;
  let fullId: string;
  let fullEmpresaId: string;
  let masterId: string;
  let supervisorId: string;
  let vendedorId: string;
  let vendedorOutraRedeId: string;
  let matriz: Db;
  let modeloFullId: string;

  beforeAll(async () => {
    matriz = await loginMatriz();
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-full-5c" });
    masterId = master.userId;
    const supervisor = await criarPersonaComEmpresa("supervisor", {
      emailPrefix: "supervisor-full-5c",
    });
    supervisorId = supervisor.userId;

    const { data: modelo } = await admin
      .from("modelos_franquia")
      .select("id")
      .eq("modalidade", "full")
      .limit(1)
      .single();
    if (!modelo) throw new Error("Modelo Full ausente");
    modeloFullId = modelo.id;

    const empresa = await criarEmpresa();
    fullEmpresaId = empresa.id;
    const pessoaFull = await criarUsuario(`${uniq("full-5c")}@teste.local`);
    full = pessoaFull.client;
    fullId = pessoaFull.userId;
    // A montagem respeita a constraint: enquanto recebe role/modelo, a Full
    // permanece suspensa; só é ativada depois de apontar para Master válido.
    await admin
      .from("profiles")
      .update({
        empresa_id: empresa.id,
        status: "suspensa",
        desligado_em: new Date().toISOString(),
        desligado_motivo: "Montagem transacional da fixture Full",
      })
      .eq("id", fullId);
    await admin.from("user_roles").insert({ user_id: fullId, role: "franqueado" });
    const { error: eModelo } = await admin
      .from("empresas")
      .update({ modelo_id: modeloFullId })
      .eq("id", empresa.id);
    if (eModelo) throw eModelo;
    const { error: eAtivar } = await admin
      .from("profiles")
      .update({
        superior_id: masterId,
        status: "aprovada",
        desligado_em: null,
        desligado_motivo: null,
      })
      .eq("id", fullId);
    if (eAtivar) throw eAtivar;

    const vendedor = await criarUsuario(`${uniq("vend-full-5c")}@teste.local`);
    vendedorId = vendedor.userId;
    await admin
      .from("profiles")
      .update({ empresa_id: empresa.id, superior_id: fullId, status: "aprovada" })
      .eq("id", vendedorId);
    await admin.from("user_roles").insert({ user_id: vendedorId, role: "vendedor" });

    const outro = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "vend-outra-rede-5c",
    });
    vendedorOutraRedeId = outro.userId;
  });

  it("NEGATIVO: Full ativa sem superior é rejeitada", async () => {
    const { error } = await admin.from("profiles").update({ superior_id: null }).eq("id", fullId);
    expect(error?.message).toContain("Franquia Full ativa exige superior_id");
  });

  it("NEGATIVO: Supervisor não pode ocupar o vínculo obrigatório de Master", async () => {
    const { error } = await admin
      .from("profiles")
      .update({ superior_id: supervisorId })
      .eq("id", fullId);
    expect(error?.message).toContain("Master ativo e aprovado");
  });

  it("POSITIVO: Full ativa vinculada a Master ativo permanece válida", async () => {
    const { error } = await admin
      .from("profiles")
      .update({ superior_id: masterId })
      .eq("id", fullId);
    expect(error).toBeNull();
  });

  it("NEGATIVO: Master que possui Full ativa não pode ser desligado", async () => {
    const { error } = await admin
      .from("profiles")
      .update({
        status: "suspensa",
        desligado_em: new Date().toISOString(),
        desligado_motivo: "Tentativa de desligar Master com Full ativa",
      })
      .eq("id", masterId);
    expect(error?.message).toContain("Master ativo e aprovado");
  });

  it("NEGATIVO/POSITIVO: aprovação da Full exige Master válido", async () => {
    const empresa = await criarEmpresa({ status: "pendente" });
    const candidato = await criarUsuario(`${uniq("full-aprovacao-5c")}@teste.local`);
    await admin
      .from("profiles")
      .update({ empresa_id: empresa.id, status: "pendente" })
      .eq("id", candidato.userId);
    await admin.from("empresas").update({ modelo_id: modeloFullId }).eq("id", empresa.id);

    const base = {
      p_empresa_id: empresa.id,
      p_perfil: "franqueado" as const,
      p_produtos: [],
      p_canais: [],
    };
    const { error: semMaster } = await matriz.rpc("aprovar_acesso", {
      ...base,
      p_superior_id: undefined,
    });
    expect(semMaster?.message).toContain("Franquia Full exige um Master ativo");

    const { error: comSupervisor } = await matriz.rpc("aprovar_acesso", {
      ...base,
      p_superior_id: supervisorId,
    });
    expect(comSupervisor?.message).toContain("Franquia Full exige um Master ativo");

    const masterSuspenso = await criarPersonaComEmpresa("master", {
      emailPrefix: "master-suspenso-aprovacao-full",
    });
    await admin
      .from("profiles")
      .update({
        status: "suspensa",
        desligado_em: new Date().toISOString(),
        desligado_motivo: "Master suspenso para teste negativo",
      })
      .eq("id", masterSuspenso.userId);
    const { error: comMasterSuspenso } = await matriz.rpc("aprovar_acesso", {
      ...base,
      p_superior_id: masterSuspenso.userId,
    });
    expect(comMasterSuspenso?.message).toContain("Franquia Full exige um Master ativo");

    const { error: comMaster } = await matriz.rpc("aprovar_acesso", {
      ...base,
      p_superior_id: masterId,
    });
    expect(comMaster).toBeNull();
  });

  it("NEGATIVO: Full órfã suspensa perde acesso imediatamente com JWT antigo", async () => {
    const empresa = await criarEmpresa();
    const orfa = await criarUsuario(`${uniq("full-orfa-legada-5c")}@teste.local`);
    await admin
      .from("profiles")
      .update({
        empresa_id: empresa.id,
        status: "suspensa",
        desligado_em: new Date().toISOString(),
        desligado_motivo: "Regularização obrigatória: vincule um Master ativo à Franquia Full.",
      })
      .eq("id", orfa.userId);
    await admin.from("user_roles").insert({ user_id: orfa.userId, role: "franqueado" });
    await admin.from("empresas").update({ modelo_id: modeloFullId }).eq("id", empresa.id);
    await admin.from("full_master_historico").insert({
      full_profile_id: orfa.userId,
      acao: "suspensao_orfandade",
      motivo: "Full suspensa automaticamente: Master ativo obrigatório não configurado.",
    });

    const { data, error } = await orfa.client.from("leads").select("id").limit(1);
    expect(data).toBeNull();
    expect(error?.message).toBe("Acesso desativado. Entre em contato com a Matriz.");

    const { data: historico } = await matriz
      .from("full_master_historico")
      .select("acao")
      .eq("full_profile_id", orfa.userId)
      .single();
    expect(historico?.acao).toBe("suspensao_orfandade");
  });

  it("POSITIVO/NEGATIVO: Full configura o próprio vendedor, nunca outra rede", async () => {
    const { data, error } = await full.rpc("fn_configurar_vendedor_full", {
      p_vendedor_id: vendedorId,
      p_equipe: "Equipe Norte",
      p_leads_dia: 7,
      p_produtos: ["auto"],
      p_canais: [],
      p_comissao_venda_pct: 40,
      p_comissao_renovacao_pct: 20,
    });
    expect(error).toBeNull();
    expect(data?.comissao_venda_pct).toBe(40);

    const { data: perfil } = await full
      .from("profiles")
      .select("equipe,leads_dia,superior_id")
      .eq("id", vendedorId)
      .single();
    expect(perfil).toMatchObject({ equipe: "Equipe Norte", leads_dia: 7, superior_id: fullId });

    const { error: foraEscopo } = await full.rpc("fn_configurar_vendedor_full", {
      p_vendedor_id: vendedorOutraRedeId,
      p_equipe: "Tentativa",
    });
    expect(foraEscopo?.message).toContain("não pertence à sua Franquia Full");
  });

  it("NEGATIVO: configuração rejeita canal de outra Full e canal inativo", async () => {
    const outraEmpresa = await criarEmpresa();
    const { data: canais, error: criarCanais } = await admin
      .from("canais")
      .insert([
        {
          nome: uniq("Canal outra Full"),
          tipo: "manual",
          empresa_id: outraEmpresa.id,
          ativo: true,
        },
        { nome: uniq("Canal inativo"), tipo: "manual", empresa_id: fullEmpresaId, ativo: false },
      ])
      .select("id,ativo");
    if (criarCanais || !canais) throw criarCanais;

    for (const canal of canais) {
      const { error } = await full.rpc("fn_configurar_vendedor_full", {
        p_vendedor_id: vendedorId,
        p_canais: [canal.id],
      });
      expect(error?.message).toContain("Canal inválido, inativo ou pertencente a outra empresa");
    }
  });

  it("NEGATIVO: role autenticada não chama o RPC interno de cadastro direto", async () => {
    const { error } = await full.rpc("fn_cadastrar_vendedor_full", {
      p_user_id: crypto.randomUUID(),
      p_criado_por: fullId,
      p_nome: "Tentativa cliente",
      p_email: `${uniq("cadastro-cliente")}@teste.local`,
      p_produtos: [],
      p_canais: [],
    });
    expect(error).not.toBeNull();
  });

  it("POSITIVO: função segura cadastra vendedor diretamente na empresa da Full", async () => {
    const auth = await admin.auth.admin.createUser({
      email: `${uniq("cadastro-direto-full")}@teste.local`,
      password: "Teste@123!",
      email_confirm: true,
    });
    if (!auth.data.user) throw auth.error;
    const { data, error } = await admin.rpc("fn_cadastrar_vendedor_full", {
      p_user_id: auth.data.user.id,
      p_criado_por: fullId,
      p_nome: "Vendedora Cadastro Direto",
      p_email: auth.data.user.email!,
      p_cpf: "123.456.789-01",
      p_celular: "(11) 99999-0000",
      p_equipe: "Equipe Direta",
      p_leads_dia: 5,
      p_produtos: [],
      p_canais: [],
      p_comissao_venda_pct: 35,
      p_comissao_renovacao_pct: 15,
    });
    expect(error).toBeNull();
    expect(data).toBe(auth.data.user.id);

    const { data: criado } = await full
      .from("profiles")
      .select("empresa_id,superior_id,status,equipe,leads_dia,cpf,telefone")
      .eq("id", auth.data.user.id)
      .single();
    expect(criado).toMatchObject({
      empresa_id: fullEmpresaId,
      superior_id: fullId,
      status: "aprovada",
      equipe: "Equipe Direta",
      leads_dia: 5,
      cpf: "12345678901",
      telefone: "11999990000",
    });
  });

  it("NEGATIVO: cadastro direto rejeita canal inativo e canal de outra empresa", async () => {
    const outraEmpresa = await criarEmpresa();
    const { data: canais } = await admin
      .from("canais")
      .insert([
        {
          nome: uniq("Canal cadastro inativo"),
          tipo: "manual",
          empresa_id: fullEmpresaId,
          ativo: false,
        },
        {
          nome: uniq("Canal cadastro cross tenant"),
          tipo: "manual",
          empresa_id: outraEmpresa.id,
          ativo: true,
        },
      ])
      .select("id");
    if (!canais) throw new Error("canais de teste não criados");

    for (const canal of canais) {
      const auth = await admin.auth.admin.createUser({
        email: `${uniq("cadastro-canal-invalido")}@teste.local`,
        password: "Teste@123!",
        email_confirm: true,
      });
      if (!auth.data.user) throw auth.error;
      const { error } = await admin.rpc("fn_cadastrar_vendedor_full", {
        p_user_id: auth.data.user.id,
        p_criado_por: fullId,
        p_nome: "Canal inválido",
        p_email: auth.data.user.email!,
        p_canais: [canal.id],
      });
      expect(error?.message).toContain("Canal inválido, inativo ou pertencente a outra empresa");
    }
  });

  it("NEGATIVO: cadastro direto rejeita CPF e celular fora do formato persistível", async () => {
    for (const identidade of [
      { p_cpf: "123", p_celular: "11999990000", mensagem: "CPF inválido" },
      { p_cpf: "12345678901", p_celular: "999", mensagem: "Celular inválido" },
    ]) {
      const auth = await admin.auth.admin.createUser({
        email: `${uniq("cadastro-identidade-invalida")}@teste.local`,
        password: "Teste@123!",
        email_confirm: true,
      });
      if (!auth.data.user) throw auth.error;
      const { error } = await admin.rpc("fn_cadastrar_vendedor_full", {
        p_user_id: auth.data.user.id,
        p_criado_por: fullId,
        p_nome: "Identidade inválida",
        p_email: auth.data.user.email!,
        p_cpf: identidade.p_cpf,
        p_celular: identidade.p_celular,
        p_canais: [],
      });
      expect(error?.message).toContain(identidade.mensagem);
    }
  });

  it("Full desliga diretamente; somente Matriz reinclui", async () => {
    const { error: desligar } = await full.rpc("fn_desligar_vendedor_full", {
      p_vendedor_id: vendedorId,
      p_motivo: "Desligamento de teste V11.5c",
    });
    expect(desligar).toBeNull();

    const { error: reincluirPelaFull } = await full.rpc("fn_reincluir_vendedor_full", {
      p_vendedor_id: vendedorId,
      p_motivo: "Tentativa indevida",
    });
    expect(reincluirPelaFull?.message).toContain("Apenas a Matriz");

    const { error: reincluirMatriz } = await matriz.rpc("fn_reincluir_vendedor_full", {
      p_vendedor_id: vendedorId,
      p_motivo: "Reinclusão aprovada pela Matriz",
    });
    expect(reincluirMatriz).toBeNull();
  });

  it("NEGATIVO: reinclusão não possui semântica global fora de Franquia Full", async () => {
    await admin
      .from("profiles")
      .update({
        status: "suspensa",
        desligado_em: new Date().toISOString(),
        desligado_motivo: "Teste fora da Full",
      })
      .eq("id", vendedorOutraRedeId);
    const { error } = await matriz.rpc("fn_reincluir_vendedor_full", {
      p_vendedor_id: vendedorOutraRedeId,
      p_motivo: "Tentativa fora da Full",
    });
    expect(error?.message).toContain("de Franquia Full não encontrado");
  });

  it("NEGATIVO: históricos de vínculo e gestão são imutáveis", async () => {
    const { error: config } = await admin
      .from("full_vendedor_historico")
      .update({ motivo: "tentativa" })
      .eq("vendedor_id", vendedorId);
    expect(config?.message).toContain("imutável");
  });
});
