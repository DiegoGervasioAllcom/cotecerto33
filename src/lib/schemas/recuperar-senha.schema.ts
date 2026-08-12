import { z } from "zod";

export const recuperarSenhaSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe o seu e-mail.")
    .max(254, "O e-mail pode ter no máximo 254 caracteres.")
    .email("Informe um e-mail válido."),
});

export type RecuperarSenhaForm = z.infer<typeof recuperarSenhaSchema>;
