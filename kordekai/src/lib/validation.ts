import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(24, "Username must be at most 24 characters.")
  .regex(/^[A-Za-z0-9_]+$/, "Username can only contain letters, numbers and underscores.");

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(128, "Password must be at most 128 characters.");

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  website: z.string().max(200).optional(), // honeypot: real users never fill this in
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const settingsSchema = z.object({
  theme: z.enum(["dark", "light", "system"]).optional(),
  customInstructions: z.string().max(1500, "Keep preferences under 1,500 characters.").optional(),
});

export const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Message is empty.").max(8000, "Message is too long (max 8,000 characters)."),
});

export const renameSchema = z.object({
  title: z.string().trim().min(1, "Title can't be empty.").max(100, "Title is too long."),
});

export const banSchema = z.object({
  reason: z.string().trim().min(3, "Please give a reason.").max(500),
  durationHours: z.number().int().min(1).max(24 * 365).nullable(), // null = permanent
  restrictSignups: z.boolean().default(false),
  restrictDays: z.number().int().min(1).max(30).default(3),
});

export const aiSettingsSchema = z.object({
  systemPrompt: z.string().trim().min(1, "System prompt can't be empty.").max(8000, "System prompt is too long."),
  model: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9._:\-/]+$/, "Invalid model id."),
});
