import { z } from "zod";

// Mesmas opções do protótipo (`openCadDireto`, select #xv_equipe).
export const EQUIPES_FULL = ["Novas Vendas", "Remalho"] as const;

export const cadastroDiretoIdentidadeSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome completo.").max(150),
  email: z.string().trim().email("Informe um e-mail válido.").max(254),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "Informe um CPF válido."),
  celular: z.string().regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, "Informe um celular válido."),
});

// Cadastro direto é 1 tela só, igual ao protótipo (`openCadDireto`): nome,
// documento, contato e a equipe. Leads/comissão/produtos/canais ficam pra
// "próxima tela" (aqui, o modal Configurar que abre em seguida) — o
// protótipo já tratava assim, o app antes juntava tudo no mesmo cadastro.
export const cadastroDiretoFullSchema = cadastroDiretoIdentidadeSchema.extend({
  equipe: z.enum(EQUIPES_FULL),
});
