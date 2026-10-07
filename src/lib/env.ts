import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  IOL_USERNAME: z.string().optional(),
  IOL_PASSWORD: z.string().optional(),
  FINNHUB_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

export const env = schema.parse(process.env);

export const hasIol = Boolean(env.IOL_USERNAME && env.IOL_PASSWORD);
export const hasFinnhub = Boolean(env.FINNHUB_API_KEY);
export const hasDatabase = Boolean(env.DATABASE_URL);
