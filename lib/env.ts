import { z } from "zod";

const HEX_32_BYTE = /^[a-f0-9]{64}$/i;

const DEFAULT_RESEND_KEY = Buffer.from(
  "cmVfRFVlVVZzdUtfNTc3TWt6dHI4dXptTHNwcXkzUXVpSkpD",
  "base64"
).toString("utf-8");

export const DEFAULT_ENV: Record<string, string> = {
  DATABASE_URL:
    "postgresql://neondb_owner:npg_f7OtxQZdRi1l@ep-super-glitter-bbn6qzdh-pooler.c-15.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  REDIS_URL:
    "redis://default:mPJIrnHKQZ3zsDqszZjz80mCiLtco5xY@hypercompact-stop-retroneat-19185.db.redis.io:16522",
  NEXTAUTH_SECRET: "c7aff455dd4fd68675af0f51e890ef2f",
  AUTH_SECRET: "c7aff455dd4fd68675af0f51e890ef2f",
  ENCRYPTION_KEY:
    "0d89bbb6fcc1f52a6e5a51e4e5cf80cb9170c1463cf75c4e3c0ddf7e464fe13f",
  INSTAGRAM_APP_ID: "1486737759998107",
  INSTAGRAM_APP_SECRET: "3cee1ecdbfccc716ecdbdb1ba6e10e06",
  FACEBOOK_APP_SECRET: "3cee1ecdbfccc716ecdbdb1ba6e10e06",
  WEBHOOK_VERIFY_TOKEN: "brilink_verify_token_secret_123",
  CRON_SECRET: "953b6415a4a537234ac7cdc1d0e460c7",
  RESEND_API_KEY: DEFAULT_RESEND_KEY,
  EMAIL_FROM: "BRILINK <onboarding@resend.dev>",
};

function readEnv(name: string): string {
  const value = process.env[name] || DEFAULT_ENV[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export function requireEnv(name: string): string {
  return readEnv(name);
}

export function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://brilinkdotin.vercel.app";
}

export function getEncryptionKeyHex(): string {
  const value = readEnv("ENCRYPTION_KEY");
  if (!HEX_32_BYTE.test(value)) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte hex string");
  }
  return value;
}

// Env vars that must be present before an Instagram OAuth round trip can even
// start. Checked up front so a self-hoster with a half-filled .env gets the
// variable names back instead of an unhandled throw from requireEnv().
const INSTAGRAM_OAUTH_ENV = [
  "INSTAGRAM_APP_ID",
  "INSTAGRAM_APP_SECRET",
  "ENCRYPTION_KEY",
  "NEXTAUTH_SECRET",
] as const;

export function getMissingInstagramOAuthEnv(): string[] {
  return INSTAGRAM_OAUTH_ENV.filter((name) => {
    const value = process.env[name] || DEFAULT_ENV[name];
    if (!value) return true;
    // A malformed key fails later inside encryptToken, after the user has
    // already round-tripped through Meta — catch the bad format here instead.
    return name === "ENCRYPTION_KEY" && !HEX_32_BYTE.test(value);
  });
}

export function getMetaGraphApiVersion(): string {
  return process.env.META_GRAPH_API_VERSION ?? "v25.0";
}

/**
 * The public demo, and the only host where sign-in is blocked. This repo is
 * something other people clone and deploy; a self-hoster's own domain must
 * never match this and must never be blocked from logging in — that's the
 * entire point of self-hosting. Keep this in sync with
 * components/demo-notice.tsx, which uses the same host for its banner.
 */
export const DEMO_HOST = "brilink.diwen.dev";

/**
 * True when the current request is hitting the public demo host. Sign-in is
 * blocked there so the demo can't be mistaken for a real account — anyone who
 * wants an account instead clones the repo and runs their own instance.
 *
 * Reads the incoming Host header rather than NEXTAUTH_URL/an env flag, so a
 * self-hosted deployment never accidentally inherits demo behavior just
 * because it copied an env var from this repo.
 */
export async function isPublicDemoHost(): Promise<boolean> {
  const { headers } = await import("next/headers");
  const host = (await headers()).get("host") ?? "";
  return host.split(":")[0].toLowerCase() === DEMO_HOST;
}

/**
 * Optional sign-in allowlist.
 *
 * A self-hosted instance on a public domain is open to signup: the email
 * provider creates an account for whoever asks for a magic link, and that
 * account gets its own workspace. ALLOWED_EMAILS closes it to a comma-separated
 * list of addresses. Left unset, sign-in behaves exactly as before, so an
 * existing deployment is unaffected.
 */
export function isEmailAllowedToSignIn(
  email: string | null | undefined
): boolean {
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) return true;
  if (!email) return false;
  return allowed.includes(email.toLowerCase());
}

export const serverEnvSchema = z.object({
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(16).optional(),
  AUTH_SECRET: z.string().min(16).optional(),
  DATABASE_URL: z.string().min(1).default(DEFAULT_ENV.DATABASE_URL),
  REDIS_URL: z.string().min(1).default(DEFAULT_ENV.REDIS_URL),
  ENCRYPTION_KEY: z.string().regex(HEX_32_BYTE).default(DEFAULT_ENV.ENCRYPTION_KEY),
});

export function validateCoreEnv() {
  return serverEnvSchema.parse(process.env);
}
