// V11 · C13 — "Quero falar com a Cote Certo" (tela de login, rota pública).
import { z } from "zod";
import { email } from "@/lib/schemas/common";

export const TEMAS_CONTATO = ["Comercial", "Financeiro", "Outro"] as const;

export const contatoMatrizSchema = z.object({
  nome: z.string().trim().min(1, "Informe seu nome.").max(150, "Nome muito longo."),
  email,
  tema: z.enum(TEMAS_CONTATO, { message: "Selecione um tema." }),
  mensagem: z.string().trim().min(1, "Escreva sua mensagem.").max(2000, "Mensagem muito longa."),
});

export type ContatoMatrizValues = z.infer<typeof contatoMatrizSchema>;
