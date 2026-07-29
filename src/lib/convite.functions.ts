import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cadastro a partir de um Convite Supper (V11 · C9).
 *
 * Separado de `cadastrarFranquia` de propósito: aqui o perfil e o vínculo NÃO vêm
 * da tela — vêm do convite, e são revalidados no servidor. A tela mostra os dois
 * em texto fixo, mas isso é apresentação; quem decide é o token.
 */

type PayloadConvite = {
  token: string;
  email: string;
  password: string;
  nome: string;
  documento: string;
  extras: Record<string, string>;
};

function getAdmin(): SupabaseClient {
  const url =
    import.meta.env?.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SELF_SUPABASE_URL;
  const serviceKey = process.env.SELF_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Configuração do servidor ausente (URL/Service Role).");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Mensagem de cada motivo de recusa devolvido por `abrir_convite`. */
const MOTIVO_MSG: Record<string, string> = {
  expirado: "Este convite expirou. Peça um novo a quem te convidou.",
  usado: "Este convite já foi usado. Peça um novo a quem te convidou.",
  inexistente: "Convite não encontrado. Confira o link ou peça um novo.",
};

export const cadastrarPorConvite = createServerFn({ method: "POST" })
  .inputValidator((data: PayloadConvite) => {
    if (!data?.token) throw new Error("Convite ausente.");
    if (!data?.email || !data?.password || data.password.length < 6) {
      throw new Error("E-mail e senha (mín. 6) são obrigatórios.");
    }
    if (!data.nome || !data.documento) {
      throw new Error("Nome e documento são obrigatórios.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const admin = getAdmin();

    // 1. Revalida o convite NO SERVIDOR. A tela já validou para renderizar, mas
    //    o que chega aqui é entrada do cliente — o token pode ter expirado ou
    //    sido usado entre abrir a página e enviar o formulário.
    const { data: aberto, error: eAbrir } = await admin.rpc("abrir_convite", {
      p_token: data.token,
    });
    if (eAbrir) throw new Error(eAbrir.message);

    const convite = aberto as {
      ok: boolean;
      motivo?: string;
      trilha: string;
      perfil: string | null;
    } | null;

    if (!convite?.ok) {
      throw new Error(MOTIVO_MSG[convite?.motivo ?? "inexistente"] ?? MOTIVO_MSG.inexistente);
    }

    // 2. O tipo de pessoa é DERIVADO do convite, não escolhido por quem preenche
    //    (é o `authPerfilNext` do protótipo): time interno e vendedor são CPF; as
    //    franquias e o Master são CNPJ.
    const tipo: "pj" | "pf" =
      convite.trilha === "interno" || convite.perfil === "vendedor" ? "pf" : "pj";

    // 3. Cria o usuário.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nome: data.extras.socio_nome || data.nome,
        empresa_nome: data.nome,
        empresa_tipo: tipo,
        empresa_documento: data.documento,
      },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message ?? "Falha ao criar usuário.";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
        throw new Error("Este e-mail já está cadastrado.");
      }
      throw new Error(msg);
    }
    const userId = created.user.id;

    // 4. Cria o pedido (empresa pendente), reaproveitando a RPC do cadastro.
    const { error: rpcErr } = await admin.rpc("cadastrar_franquia_admin", {
      p: {
        ...data.extras,
        nome: data.nome,
        documento: data.documento,
        email: data.email,
        tipo,
        _user_id: userId,
      },
      p_user: userId,
    });
    if (rpcErr) {
      // Sem empresa não existe pedido, e o convite não pode ser marcado como
      // usado — melhor falhar visível do que deixar um usuário órfão e um
      // convite queimado.
      throw new Error(`Falha ao registrar o pedido: ${rpcErr.message}`);
    }

    // 5. Fecha o convite e amarra o pedido a ele. É o que faz o pedido chegar
    //    classificado na fila.
    const { data: consumido, error: eConsumir } = await admin.rpc("consumir_convite", {
      p_token: data.token,
      p_user_id: userId,
    });
    if (eConsumir) throw new Error(eConsumir.message);
    if (consumido !== true) {
      throw new Error(
        "Este convite deixou de ser válido durante o envio. Peça um novo a quem te convidou.",
      );
    }

    return { ok: true, userId };
  });
