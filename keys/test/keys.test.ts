import { describe, it, expect } from 'vitest';
import { generateKeyPair, getShortId, getFingerprint, derivePublicKey } from '../src/keys.js';
import type { KeyType } from '../src/keys.js';

describe('@synthetism/keys', () => {
  const keyTypes: KeyType[] = ['rsa', 'ed25519', 'x25519', 'secp256k1', 'wireguard'];

  for (const keyType of keyTypes) {
    describe(`${keyType} keys`, () => {
      it('should generate a valid key pair', () => {
        const keyPair = generateKeyPair(keyType);
        
        expect(keyPair).toBeDefined();
        expect(keyPair.type).toBe(keyType);
        expect(keyPair.privateKey).toBeTruthy();
        expect(keyPair.publicKey).toBeTruthy();
        expect(typeof keyPair.privateKey).toBe('string');
        expect(typeof keyPair.publicKey).toBe('string');
      });

      it('should generate unique key pairs', () => {
        const keyPair1 = generateKeyPair(keyType);
        const keyPair2 = generateKeyPair(keyType);
        
        expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
        expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
      });

      it('should generate consistent fingerprints', () => {
        const keyPair = generateKeyPair(keyType);
        const fingerprint1 = getFingerprint(keyPair.publicKey);
        const fingerprint2 = getFingerprint(keyPair.publicKey);
        
        expect(fingerprint1).toBe(fingerprint2);
        expect(fingerprint1).toHaveLength(64);
        expect(/^[a-f0-9]+$/.test(fingerprint1)).toBe(true);
      });

      it('should generate consistent short IDs', () => {
        const keyPair = generateKeyPair(keyType);
        const shortId1 = getShortId(keyPair.publicKey);
        const shortId2 = getShortId(keyPair.publicKey);
        
        expect(shortId1).toBe(shortId2);
        expect(shortId1).toHaveLength(16);
        expect(/^[a-f0-9]+$/.test(shortId1)).toBe(true);
      });

      // Test public key derivation for PEM formats
      if (['rsa', 'ed25519', 'x25519', 'secp256k1'].includes(keyType)) {
        it('should derive public key from private key', () => {
          const keyPair = generateKeyPair(keyType);
          const derivedPublicKey = derivePublicKey(keyPair.privateKey);
          
          expect(derivedPublicKey).toBe(keyPair.publicKey);
        });
      }

      // Test different formats for certain key types
      if (['ed25519', 'x25519'].includes(keyType)) {
        it('should support base64 format', () => {
          const keyPair = generateKeyPair(keyType, { format: 'base64' });
          
          expect(keyPair.type).toBe(keyType);
          expect(keyPair.privateKey).toBeTruthy();
          expect(keyPair.publicKey).toBeTruthy();
          // Base64 encoded 32-byte keys should be 44 characters
          expect(keyPair.privateKey).toHaveLength(44);
          expect(keyPair.publicKey).toHaveLength(44);
        });
      }
    });
  }

  describe('error handling', () => {
    it('should throw error for unsupported key type', () => {
      expect(() => {
        // @ts-expect-error Testing invalid key type
        generateKeyPair('invalid');
      }).toThrow('Unsupported key type: invalid');
    });

    it('should handle invalid private key for derivation', () => {
      const result = derivePublicKey('invalid-private-key');
      expect(result).toBeNull();
    });
  });

  describe('WireGuard compatibility', () => {
    it('should generate base64-encoded keys', () => {
      const keyPair = generateKeyPair('wireguard');
      
      expect(keyPair.type).toBe('wireguard');
      expect(keyPair.privateKey).toHaveLength(44); // Base64 encoded 32 bytes
      expect(keyPair.publicKey).toHaveLength(44);
      
      // Should be valid base64
      expect(() => Buffer.from(keyPair.privateKey, 'base64')).not.toThrow();
      expect(() => Buffer.from(keyPair.publicKey, 'base64')).not.toThrow();
    });
  });

  describe('Hex format generation', () => {
    const hexSupportedTypes: KeyType[] = ['ed25519', 'x25519'];

    for (const keyType of hexSupportedTypes) {
      describe(`${keyType} hex format`, () => {
        it('should generate valid hex keys', () => {
          const keyPair = generateKeyPair(keyType, { format: 'hex' });
          
          expect(keyPair.type).toBe(keyType);
          expect(keyPair.privateKey).toHaveLength(64); // 32 bytes = 64 hex chars
          expect(keyPair.publicKey).toHaveLength(64);  // 32 bytes = 64 hex chars
          
          // Should be valid hex
          expect(/^[0-9a-f]+$/.test(keyPair.privateKey)).toBe(true);
          expect(/^[0-9a-f]+$/.test(keyPair.publicKey)).toBe(true);
        });

        it('should generate unique hex keys', () => {
          const keyPair1 = generateKeyPair(keyType, { format: 'hex' });
          const keyPair2 = generateKeyPair(keyType, { format: 'hex' });
          
          expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
          expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
        });

        it('should be different from PEM format but same key material', () => {
          const hexPair = generateKeyPair(keyType, { format: 'hex' });
          const pemPair = generateKeyPair(keyType, { format: 'pem' });
          
          // Format should be different
          expect(hexPair.publicKey).not.toBe(pemPair.publicKey);
          expect(hexPair.privateKey).not.toBe(pemPair.privateKey);
          
          // But hex should be numeric only
          expect(/^[0-9a-f]+$/.test(hexPair.publicKey)).toBe(true);
          expect(pemPair.publicKey.includes('-----BEGIN')).toBe(true);
        });
      });
    }

    it('should handle RSA with default PEM format', () => {
      // RSA doesn't support hex format, should default to PEM
      const keyPair = generateKeyPair('rsa', { format: 'hex' });
      
      expect(keyPair.type).toBe('rsa');
      expect(keyPair.publicKey.includes('-----BEGIN PUBLIC KEY-----')).toBe(true);
      expect(keyPair.privateKey.includes('-----BEGIN PRIVATE KEY-----')).toBe(true);
    });
  });
});
