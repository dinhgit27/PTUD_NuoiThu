import { randomBytes } from 'crypto';

let ephemeralSecret: string | undefined;

export function getJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32).toString('hex');
    console.warn('JWT_SECRET is not configured; using an ephemeral secret for this process.');
  }
  return ephemeralSecret;
}
