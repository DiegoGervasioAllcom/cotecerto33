import { z } from "zod";

export const criarSenhaSchema = z
  .object({
    senha: z
      .string()
      .min(8, "A senha precisa ter no mínimo 8 caracteres.")
      .max(72, "A senha pode ter no máximo 72 caracteres.")
      .regex(/[A-Za-z]/, "A senha precisa ter pelo menos uma letra.")
      .regex(/[0-9]/, "A senha precisa ter pelo menos um número."),
    confirmarSenha: z.string().max(72, "A confirmação pode ter no máximo 72 caracteres."),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: "As senhas não coincidem.",
    path: ["confirmarSenha"],
  });

export type CriarSenhaForm = z.infer<typeof criarSenhaSchema>;
