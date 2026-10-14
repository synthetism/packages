/**
 * Signature verification — pure functions, one per algorithm.
 *
 * No keys, no state: a *verifier* needs only a public key and a signature.
 * That is why verification lives here, on the frozen floor, while signing lives
 * in `@synthetism/signer`.
 */

import * as crypto from 'node:crypto';
import { base64UrlToBase64 } from './utils.js';

/**
 * Validate base64 format
 * Ensures the signature is properly formatted base64 before crypto operations
 */
export function isValidBase64(str: string): boolean {
  try {
    // Empty strings are not valid base64
    if (!str || str === '') {
      return false;
    }
    
    // Check if string contains only valid base64 characters
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) {
      return false;
    }
    
    // Check if the decoded and re-encoded string matches the original
    const decoded = Buffer.from(str, 'base64');
    const reencoded = decoded.toString('base64');
    return reencoded === str;
  } catch {
    return false;
  }
}

/**
 * Validate base64url format
 * Ensures the signature is properly formatted base64url before crypto operations
 */
export function isValidBase64Url(str: string): boolean {
  try {
    // Empty strings are not valid base64url
    if (!str || str === '') {
      return false;
    }
    
    // Check if string contains only valid base64url characters
    const base64UrlRegex = /^[A-Za-z0-9_-]*$/;
    if (!base64UrlRegex.test(str)) {
      return false;
    }
    
    // Try to convert to base64 and validate
    const base64 = base64UrlToBase64(str);
    return isValidBase64(base64);
  } catch {
    return false;
  }
}

/**
 * Normalize signature to base64 format for crypto operations
 * Accepts both base64 and base64url formats
 */
export function normalizeSignature(signature: string): string | null {
  // Check if it's already valid base64
  if (isValidBase64(signature)) {
    return signature;
  }
  
  // Check if it's base64url and convert
  if (isValidBase64Url(signature)) {
    return base64UrlToBase64(signature);
  }
  
  return null;
}

/**
 * Verify Ed25519 signature
 * @param data The original data that was signed
 * @param signature The signature in base64 or base64url format
 * @param publicKey The public key in PEM format
 * @returns true if signature is valid, false otherwise
 */
export function verifyEd25519(data: string, signature: string, publicKey: string): boolean {
  try {
    // Validate inputs
    if (!data || !signature || !publicKey) {
      return false;
    }
    
    // Normalize signature to base64 format
    const normalizedSignature = normalizeSignature(signature);
    if (!normalizedSignature) {
      return false;
    }
    
    return crypto.verify(
      null,
      Buffer.from(data),
      {
        key: publicKey,
        format: 'pem',
      },
      Buffer.from(normalizedSignature, 'base64')
    );
  } catch {
    return false;
  }
}

/**
 * Verify RSA signature
 * @param data The original data that was signed
 * @param signature The signature in base64 or base64url format
 * @param publicKey The public key in PEM format
 * @returns true if signature is valid, false otherwise
 */
export function verifyRSA(data: string, signature: string, publicKey: string): boolean {
  try {
    // Validate inputs
    if (!data || !signature || !publicKey) {
      return false;
    }
    
    // Normalize signature to base64 format
    const normalizedSignature = normalizeSignature(signature);
    if (!normalizedSignature) {
      return false;
    }
    
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, normalizedSignature, 'base64');
  } catch {
    return false;
  }
}

/**
 * Verify secp256k1 signature
 * @param data The original data that was signed
 * @param signature The signature in base64 or base64url format
 * @param publicKey The public key in PEM format
 * @returns true if signature is valid, false otherwise
 */
export function verifySecp256k1(data: string, signature: string, publicKey: string): boolean {
  try {
    // Validate inputs
    if (!data || !signature || !publicKey) {
      return false;
    }
    
    // Normalize signature to base64 format
    const normalizedSignature = normalizeSignature(signature);
    if (!normalizedSignature) {
      return false;
    }
    
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, normalizedSignature, 'base64');
  } catch {
    return false;
  }
}

/**
 * Generic verification function that dispatches to specific algorithms
 * @param data The original data that was signed
 * @param signature The signature in base64 or base64url format
 * @param publicKey The public key in PEM format
 * @param keyType The key type/algorithm
 * @returns true if signature is valid, false otherwise
 */
export function verifySignature(
  data: string, 
  signature: string, 
  publicKey: string, 
  keyType: 'ed25519' | 'rsa' | 'secp256k1' | 'x25519' | 'wireguard'
): boolean {
  switch (keyType) {
    case 'ed25519':
      return verifyEd25519(data, signature, publicKey);
    case 'rsa':
      return verifyRSA(data, signature, publicKey);
    case 'secp256k1':
      return verifySecp256k1(data, signature, publicKey);
    case 'x25519':
    case 'wireguard':
      return false; // These are not for signing
    default:
      return false;
  }
}
