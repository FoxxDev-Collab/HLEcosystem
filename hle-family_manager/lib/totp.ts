import crypto from "crypto";

const DIGITS = 6;
const PERIOD = 30;
const ALGORITHM = "sha1";

// Base32 encoding/decoding (RFC 4648)
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.replace(/[=\s]/g, "").toUpperCase();
  const bits: number[] = [];
  for (const char of cleaned) {
    const val = BASE32_CHARS.indexOf(char);
    if (val === -1) throw new Error(`Invalid base32 character: ${char}`);
    bits.push(...[4, 3, 2, 1, 0].map((i) => (val >> i) & 1));
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    bytes.push(byte);
  }
  return Buffer.from(bytes);
}

function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let encoded = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    encoded += BASE32_CHARS[parseInt(chunk, 2)];
  }
  return encoded;
}

function generateHOTP(secret: Buffer, counter: bigint): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter);

  const hmac = crypto.createHmac(ALGORITHM, secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function generateTOTP(secret: string): string {
  const key = base32Decode(secret);
  const counter = BigInt(Math.floor(Date.now() / 1000 / PERIOD));
  return generateHOTP(key, counter);
}

export function verifyTOTP(token: string, secret: string): boolean {
  const key = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000 / PERIOD);

  // Allow 1 window before and after for clock drift
  for (let i = -1; i <= 1; i++) {
    const code = generateHOTP(key, BigInt(now + i));
    if (timingSafeEqual(token, code)) return true;
  }
  return false;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function generateURI(
  email: string,
  secret: string,
  issuer: string = "HLEcosystem"
): string {
  const label = `${issuer}:${email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`;
}
