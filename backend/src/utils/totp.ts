import { createHmac, timingSafeEqual } from 'crypto';

function decodeBase32(secret: string): Buffer | null {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = secret.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let buffer = 0;
  let bitsLeft = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const value = alphabet.indexOf(character);
    if (value < 0) return null;
    buffer = (buffer << 5) | value;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      bytes.push((buffer >> bitsLeft) & 0xff);
      buffer &= (1 << bitsLeft) - 1;
    }
  }

  return bytes.length ? Buffer.from(bytes) : null;
}

export function verifyTotp(secret: string, otp: string): boolean {
  const key = decodeBase32(secret);
  if (!key || !/^\d{6}$/.test(otp)) return false;

  const submitted = Buffer.from(otp);
  const currentStep = Math.floor(Date.now() / 30_000);
  for (let offset = -1; offset <= 1; offset += 1) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(currentStep + offset));
    const digest = createHmac('sha1', key).update(counter).digest();
    const codeOffset = digest[digest.length - 1] & 0x0f;
    const binaryCode =
      ((digest[codeOffset] & 0x7f) << 24) |
      ((digest[codeOffset + 1] & 0xff) << 16) |
      ((digest[codeOffset + 2] & 0xff) << 8) |
      (digest[codeOffset + 3] & 0xff);
    const expected = Buffer.from(String(binaryCode % 1_000_000).padStart(6, '0'));
    if (timingSafeEqual(submitted, expected)) return true;
  }
  return false;
}
