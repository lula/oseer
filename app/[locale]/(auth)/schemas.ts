import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";

// Validation for the sign-in and sign-up forms.

// Messages are message keys, translated where they are shown.
const email = z.email({ error: "auth.validation.email" }).max(255);

export const signInSchema = z.object({
  email,
  // No strength rules here: existing accounts may have older passwords.
  password: z.string().min(1, { error: "auth.validation.password" }),
  rememberMe: z.boolean().optional(),
});


export type SignInValues = z.infer<typeof signInSchema>;

export const signInFormOpts = formOptions({
  defaultValues: { email: "", password: "", rememberMe: false } as SignInValues,
});
