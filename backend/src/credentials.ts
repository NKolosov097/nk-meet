import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"

export interface EncryptedCode {
  // Encrypted eight-digit code.
  ciphertext: Uint8Array
  // Fresh GCM nonce.
  nonce: Uint8Array
  // GCM integrity tag.
  tag: Uint8Array
}

export function encryptCode(
  key: Uint8Array,
  company: string,
  slug: string,
  version: number,
  code: string,
): EncryptedCode {
  const nonce = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, nonce)
  cipher.setAAD(Buffer.from(JSON.stringify([company, slug, version])))
  return {
    ciphertext: Buffer.concat([cipher.update(code, "utf8"), cipher.final()]),
    nonce,
    tag: cipher.getAuthTag(),
  }
}

export function decryptCode(
  key: Uint8Array,
  company: string,
  slug: string,
  version: number,
  encrypted: EncryptedCode,
): string {
  const cipher = createDecipheriv("aes-256-gcm", key, encrypted.nonce)
  cipher.setAAD(Buffer.from(JSON.stringify([company, slug, version])))
  cipher.setAuthTag(encrypted.tag)
  return Buffer.concat([
    cipher.update(encrypted.ciphertext),
    cipher.final(),
  ]).toString("utf8")
}

export function matchesCode(stored: string, supplied: string): boolean {
  const left = Buffer.from(stored)
  const right = Buffer.from(supplied)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function hashAccess(access: string): string {
  return createHash("sha256").update(access).digest("hex")
}

export function newAccess(): string {
  return randomBytes(32).toString("base64url")
}
