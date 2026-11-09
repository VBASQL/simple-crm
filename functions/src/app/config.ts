import { z } from 'zod';

/**
 * Validated runtime config, built once in the container. This is the only
 * place `process.env` is read (CLAUDE.md §3).
 *
 * `GLOBALEX_API_KEYS` is a stop-gap for local/dev: a comma-separated list of
 * accepted X-API-Key values. In production each company's key lives in Secret
 * Manager; wiring that is a follow-up.
 */
const ConfigSchema = z.object({
  region: z.string().min(1).default('me-west1'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  apiKeys: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0),
    ),
  storageBucket: z.string().default(''),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return ConfigSchema.parse({
    region: env.FUNCTION_REGION,
    logLevel: env.LOG_LEVEL,
    apiKeys: env.GLOBALEX_API_KEYS,
    storageBucket: env.STORAGE_BUCKET,
  });
}
