/**
 * Format Conversion Tests
 * [∴] Comprehensive testing for key format conversion functions
 * These are CRITICAL functions that identity and crypto operations rely on
 */

import { describe, it, expect } from 'vitest';
import { 
  generateKeyPair, 
  pemToHex, 
  hexToPem, 
  hexPrivateKeyToPem,
  base64ToHex,
  hexToBase64,
  detectKeyFormat,
  toHex
} from '../src/keys.js';
import type { KeyType } from '../src/keys.js';

describe('Format Conversion Functions', () => {
  
  describe('detectKeyFormat', () => {
    it('should detect PEM format correctly', () => {
      const keyPair = generateKeyPair('ed25519', { format: 'pem' });
      
      expect(detectKeyFormat(keyPair.publicKey)).toBe('pem');
      expect(detectKeyFormat(keyPair.privateKey)).toBe('pem');
    });

    it('should detect hex format correctly', () => {
      const hexKey = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
      expect(detectKeyFormat(hexKey)).toBe('hex');
    });

    it('should detect base64 format correctly', () => {
      const base64Key = 'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSB0ZXN0IGtleQ==';
      expect(detectKeyFormat(base64Key)).toBe('base64');
    });

    it('should return null for invalid formats', () => {
      expect(detectKeyFormat('')).toBeNull();
      expect(detectKeyFormat('invalid-format-123')).toBeNull();
      expect(detectKeyFormat('not@valid#format')).toBeNull();
    });

    it('should handle whitespace correctly', () => {
      const pemKey = generateKeyPair('ed25519', { format: 'pem' }).publicKey;
      expect(detectKeyFormat(pemKey.trim())).toBe('pem');
      expect(detectKeyFormat(`  ${pemKey}  `)).toBe('pem');
    });
  });

  describe('pemToHex conversion', () => {
    const keyTypes: KeyType[] = ['ed25519', 'x25519'];

    for (const keyType of keyTypes) {
      describe(`${keyType} keys`, () => {
        it('should convert PEM public key to hex', () => {
          const keyPair = generateKeyPair(keyType, { format: 'pem' });
          const hexResult = pemToHex(keyPair.publicKey);
          
          expect(hexResult).toBeDefined();
          expect(hexResult).not.toBeNull();
          expect(typeof hexResult).toBe('string');
          if (hexResult) {
            expect(hexResult.length).toBe(64); // 32 bytes = 64 hex chars
            expect(/^[0-9a-f]+$/.test(hexResult)).toBe(true);
          }
        });

        it('should be consistent with hex generation', () => {
          const pemKeyPair = generateKeyPair(keyType, { format: 'pem' });
          const hexKeyPair = generateKeyPair(keyType, { format: 'hex' });
          
          const convertedHex = pemToHex(pemKeyPair.publicKey);
          
          expect(convertedHex).toBeDefined();
          expect(typeof convertedHex).toBe('string');
          if (convertedHex) {
            expect(convertedHex.length).toBe(hexKeyPair.publicKey.length);
          }
        });

        it('should handle invalid PEM gracefully', () => {
          expect(pemToHex('invalid-pem')).toBeNull();
          expect(pemToHex('')).toBeNull();
          expect(pemToHex('not-a-pem-key')).toBeNull();
        });
      });
    }
  });

  describe('hexToPem conversion', () => {
    const keyTypes: KeyType[] = ['ed25519', 'x25519'];

    for (const keyType of keyTypes) {
      describe(`${keyType} keys`, () => {
        it('should convert hex public key to PEM', () => {
          const hexKeyPair = generateKeyPair(keyType, { format: 'hex' });
          const pemResult = hexToPem(hexKeyPair.publicKey, keyType);
          
          expect(pemResult).toBeDefined();
          expect(pemResult).not.toBeNull();
          expect(typeof pemResult).toBe('string');
          if (pemResult) {
            expect(pemResult.includes('-----BEGIN PUBLIC KEY-----')).toBe(true);
            expect(pemResult.includes('-----END PUBLIC KEY-----')).toBe(true);
          }
        });

        it('should roundtrip correctly (hex -> PEM -> hex)', () => {
          const originalHex = generateKeyPair(keyType, { format: 'hex' }).publicKey;
          const pem = hexToPem(originalHex, keyType);
          
          expect(pem).not.toBeNull();
          if (pem) {
            const convertedHex = pemToHex(pem);
            expect(convertedHex).toBe(originalHex);
          }
        });

        it('should handle invalid hex gracefully', () => {
          expect(hexToPem('invalid-hex', keyType)).toBeNull();
          expect(hexToPem('', keyType)).toBeNull();
          expect(hexToPem('not-hex-format', keyType)).toBeNull();
          expect(hexToPem('zzzz', keyType)).toBeNull(); // Invalid hex chars
        });
      });
    }
  });

  describe('hexPrivateKeyToPem conversion', () => {
    it('should convert hex private key to PEM', () => {
      const hexKeyPair = generateKeyPair('ed25519', { format: 'hex' });
      const pemResult = hexPrivateKeyToPem(hexKeyPair.privateKey);
      
      expect(pemResult).toBeDefined();
      expect(pemResult).not.toBeNull();
      expect(typeof pemResult).toBe('string');
      if (pemResult) {
        expect(pemResult.includes('-----BEGIN PRIVATE KEY-----')).toBe(true);
        expect(pemResult.includes('-----END PRIVATE KEY-----')).toBe(true);
      }
    });

    it('should handle invalid private key hex gracefully', () => {
      expect(hexPrivateKeyToPem('invalid-hex')).toBeNull();
      expect(hexPrivateKeyToPem('')).toBeNull();
      expect(hexPrivateKeyToPem('not-hex-format')).toBeNull();
    });

    it('should work with different hex key lengths', () => {
      const keyPair = generateKeyPair('ed25519', { format: 'hex' });
      const result = hexPrivateKeyToPem(keyPair.privateKey);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.includes('PRIVATE KEY')).toBe(true);
      }
    });
  });

  describe('base64ToHex conversion', () => {
    it('should convert base64 to hex correctly', () => {
      const base64Key = Buffer.from('hello world test key 32 bytes!').toString('base64');
      const hexResult = base64ToHex(base64Key);
      
      expect(hexResult).toBeDefined();
      expect(hexResult).not.toBeNull();
      expect(typeof hexResult).toBe('string');
      if (hexResult) {
        expect(/^[0-9a-f]+$/.test(hexResult)).toBe(true);
      }
    });

    it('should be consistent with base64 key generation', () => {
      const base64KeyPair = generateKeyPair('ed25519', { format: 'base64' });
      const hexResult = base64ToHex(base64KeyPair.publicKey);
      
      expect(hexResult).toBeDefined();
      expect(hexResult).not.toBeNull();
      if (hexResult) {
        expect(hexResult.length).toBe(64); // 32 bytes = 64 hex chars
      }
    });

    it('should handle invalid base64 gracefully', () => {
      expect(base64ToHex('invalid-base64!')).toBeNull();
      expect(base64ToHex('')).toBeNull();
      expect(base64ToHex('not@base64#format')).toBeNull();
    });

    it('should roundtrip correctly (base64 -> hex -> base64)', () => {
      const originalBase64 = generateKeyPair('ed25519', { format: 'base64' }).publicKey;
      const hex = base64ToHex(originalBase64);
      
      expect(hex).not.toBeNull();
      if (hex) {
        const convertedBase64 = hexToBase64(hex);
        expect(convertedBase64).toBe(originalBase64);
      }
    });
  });

  describe('hexToBase64 conversion', () => {
    it('should convert hex to base64 correctly', () => {
      const hexKey = '48656c6c6f20776f726c6420746573742021';
      const base64Result = hexToBase64(hexKey);
      
      expect(base64Result).toBeDefined();
      expect(base64Result).not.toBeNull();
      expect(typeof base64Result).toBe('string');
      
      // Should be valid base64
      if (base64Result) {
        expect(() => Buffer.from(base64Result, 'base64')).not.toThrow();
      }
    });

    it('should be consistent with hex key generation', () => {
      const hexKeyPair = generateKeyPair('ed25519', { format: 'hex' });
      const base64Result = hexToBase64(hexKeyPair.publicKey);
      
      expect(base64Result).toBeDefined();
      expect(base64Result).not.toBeNull();
      if (base64Result) {
        expect(base64Result.length).toBe(44); // 32 bytes in base64 = 44 chars (with padding)
      }
    });

    it('should handle invalid hex gracefully', () => {
      expect(hexToBase64('invalid-hex!')).toBeNull();
      expect(hexToBase64('')).toBeNull();
      expect(hexToBase64('zzzz')).toBeNull(); // Invalid hex chars
    });
  });

  describe('toHex unified converter', () => {
    it('should convert PEM to hex', () => {
      const pemKeyPair = generateKeyPair('ed25519', { format: 'pem' });
      const hexResult = toHex(pemKeyPair.publicKey, 'ed25519');
      
      expect(hexResult).toBeDefined();
      expect(hexResult).not.toBeNull();
      expect(typeof hexResult).toBe('string');
      if (hexResult) {
        expect(/^[0-9a-f]+$/.test(hexResult)).toBe(true);
      }
    });

    it('should convert base64 to hex', () => {
      const base64KeyPair = generateKeyPair('ed25519', { format: 'base64' });
      const hexResult = toHex(base64KeyPair.publicKey);
      
      expect(hexResult).toBeDefined();
      expect(hexResult).not.toBeNull();
      expect(typeof hexResult).toBe('string');
      if (hexResult) {
        expect(/^[0-9a-f]+$/.test(hexResult)).toBe(true);
      }
    });

    it('should return hex unchanged', () => {
      const hexKeyPair = generateKeyPair('ed25519', { format: 'hex' });
      const result = toHex(hexKeyPair.publicKey);
      
      expect(result).toBe(hexKeyPair.publicKey);
    });

    it('should handle all supported formats', () => {
      const pemKey = generateKeyPair('ed25519', { format: 'pem' }).publicKey;
      const hexKey = generateKeyPair('ed25519', { format: 'hex' }).publicKey;
      const base64Key = generateKeyPair('ed25519', { format: 'base64' }).publicKey;
      
      expect(toHex(pemKey, 'ed25519')).not.toBeNull();
      expect(toHex(hexKey)).not.toBeNull();
      expect(toHex(base64Key)).not.toBeNull();
    });

    it('should handle invalid formats gracefully', () => {
      expect(toHex('invalid-format')).toBeNull();
      expect(toHex('')).toBeNull();
      expect(toHex('not@valid#format')).toBeNull();
    });
  });

  describe('Cross-format consistency', () => {
    const keyTypes: KeyType[] = ['ed25519', 'x25519'];

    for (const keyType of keyTypes) {
      describe(`${keyType} consistency`, () => {
        it('should maintain key integrity across all format conversions', () => {
          // Generate in hex (our canonical format)
          const hexKeyPair = generateKeyPair(keyType, { format: 'hex' });
          
          // Convert hex -> PEM -> hex
          const pem = hexToPem(hexKeyPair.publicKey, keyType);
          expect(pem).not.toBeNull();
          
          const base64 = hexToBase64(hexKeyPair.publicKey);
          expect(base64).not.toBeNull();
          
          if (pem && base64) {
            const hexFromPem = pemToHex(pem);
            const hexFromBase64 = base64ToHex(base64);
            
            // All should match original
            expect(hexFromPem).toBe(hexKeyPair.publicKey);
            expect(hexFromBase64).toBe(hexKeyPair.publicKey);
          }
        });

        it('should work with toHex unified converter', () => {
          const hexKey = generateKeyPair(keyType, { format: 'hex' }).publicKey;
          const pemKey = hexToPem(hexKey, keyType);
          const base64Key = hexToBase64(hexKey);
          
          expect(pemKey).not.toBeNull();
          expect(base64Key).not.toBeNull();
          
          if (pemKey && base64Key) {
            expect(toHex(hexKey)).toBe(hexKey);
            expect(toHex(pemKey, keyType)).toBe(hexKey);
            expect(toHex(base64Key)).toBe(hexKey);
          }
        });
      });
    }
  });

  describe('Error handling and edge cases', () => {
    it('should handle null and undefined inputs', () => {
      // @ts-expect-error Testing invalid inputs
      expect(pemToHex(null)).toBeNull();
      // @ts-expect-error Testing invalid inputs
      expect(hexToPem(null, 'ed25519')).toBeNull();
      // @ts-expect-error Testing invalid inputs
      expect(base64ToHex(undefined)).toBeNull();
      // @ts-expect-error Testing invalid inputs
      expect(hexToBase64(undefined)).toBeNull();
    });

    it('should handle empty strings', () => {
      expect(pemToHex('')).toBeNull();
      expect(hexToPem('', 'ed25519')).toBeNull();
      expect(base64ToHex('')).toBeNull();
      expect(hexToBase64('')).toBeNull();
      expect(detectKeyFormat('')).toBeNull();
      expect(toHex('')).toBeNull();
    });

    it('should handle malformed keys gracefully', () => {
      const malformedPem = '-----BEGIN PUBLIC KEY-----\nmalformed\n-----END PUBLIC KEY-----';
      const malformedHex = 'zzzzzz'; // Invalid hex chars
      const malformedBase64 = 'invalid@base64#';
      
      expect(pemToHex(malformedPem)).toBeNull();
      expect(hexToPem(malformedHex, 'ed25519')).toBeNull();
      expect(base64ToHex(malformedBase64)).toBeNull();
      expect(hexToBase64(malformedHex)).toBeNull();
    });

    it('should handle unsupported key types in hexToPem', () => {
      const hexKey = generateKeyPair('ed25519', { format: 'hex' }).publicKey;
      
      // @ts-expect-error Testing invalid key type
      expect(hexToPem(hexKey, 'unsupported')).toBeNull();
    });
  });
});
