import { z } from "zod";

export const recipientsSchema = z.array(z.string().trim().email()).min(1).max(5);
export function parseRecipients(value: string) {
  return recipientsSchema.safeParse(value.split(/[;,]/).map((email) => email.trim()).filter(Boolean));
}

export const reportEmailPayloadSchema = z.object({
  to: recipientsSchema,
  subject: z.string().min(1).max(240),
  text: z.string().min(1).max(20_000),
  attachment: z.object({ filename: z.string().min(1).max(180), content: z.string().min(1) }),
});
