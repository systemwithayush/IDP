import crypto from 'crypto';
import { env } from '../config/env.js';

export interface EncryptedPayload {
  encrypted: Buffer;
  iv: Buffer;
}

/**
 * AES-256-GCM encryption with random 12-byte IV per value.
 * The auth tag (16 bytes) is concatenated to the ciphertext to ensure tamper detection.
 */
export function encryptSecret(plaintext: string): EncryptedPayload {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encryptedData = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Concatenate ciphertext and auth tag
  const combined = Buffer.concat([encryptedData, authTag]);

  return {
    encrypted: combined,
    iv,
  };
}

/**
 * AES-256-GCM decryption with auth tag verification.
 */
export function decryptSecret(encryptedCombined: Buffer, iv: Buffer): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'base64');

  // Last 16 bytes are the auth tag
  const authTagLength = 16;
  if (encryptedCombined.length < authTagLength) {
    throw new Error('Invalid encrypted payload: payload is shorter than auth tag length');
  }

  const ciphertext = encryptedCombined.subarray(0, encryptedCombined.length - authTagLength);
  const authTag = encryptedCombined.subarray(encryptedCombined.length - authTagLength);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
