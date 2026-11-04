import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from workspace root or current directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('mysql://idp_user:idp_password@localhost:3306/idp_db'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters').default('test_jwt_access_secret_minimum_32_characters_123'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters').default('test_jwt_refresh_secret_minimum_32_chars_123'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ENCRYPTION_KEY: z.string().default('DkPQw/jXfmijKhyZKt39jzs8zesUYkZXDjzrKRuEiIY=').refine(
    (key) => {
      try {
        const buf = Buffer.from(key, 'base64');
        return buf.length === 32;
      } catch {
        return false;
      }
    },
    { message: 'ENCRYPTION_KEY must be a 32-byte base64-encoded string' }
  ),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().default('default_dev_webhook_secret'),
  GITHUB_OWNER: z.string().default('systemwithayush'),
  OPENAI_API_KEY: z.string().default('mock-key'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ FATAL: Invalid environment variables configuration:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
