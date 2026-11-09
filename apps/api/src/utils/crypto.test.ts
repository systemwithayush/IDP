import { encryptSecret, decryptSecret } from './crypto.js';

describe('Crypto Utilities (AES-256-GCM)', () => {
  it('encrypts and decrypts string values cleanly (round-trip)', () => {
    const secret = 'super-secret-database-password-1234!';
    const { encrypted, iv } = encryptSecret(secret);

    expect(encrypted).toBeDefined();
    expect(iv).toBeDefined();
    expect(iv.length).toBe(12);

    const decrypted = decryptSecret(encrypted, iv);
    expect(decrypted).toBe(secret);
  });

  it('generates unique random IVs on subsequent encryptions of same text', () => {
    const text = 'identical-plain-text';
    const enc1 = encryptSecret(text);
    const enc2 = encryptSecret(text);

    expect(enc1.iv.equals(enc2.iv)).toBe(false);
    expect(enc1.encrypted.equals(enc2.encrypted)).toBe(false);

    expect(decryptSecret(enc1.encrypted, enc1.iv)).toBe(text);
    expect(decryptSecret(enc2.encrypted, enc2.iv)).toBe(text);
  });

  it('fails decryption when ciphertext is tampered with', () => {
    const text = 'tamper-test';
    const { encrypted, iv } = encryptSecret(text);

    // Tamper with one byte of ciphertext
    const tampered = Buffer.from(encrypted);
    tampered[0] ^= 0xff;

    expect(() => decryptSecret(tampered, iv)).toThrow();
  });
});
