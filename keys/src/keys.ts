import * as crypto from "node:crypto";
import { isValidBase64 } from "./verify.js";

/**
 * Supported cryptographic key types
 */
export type KeyType = "rsa" | "ed25519" | "x25519" | "secp256k1" | "wireguard";

/**
 * Key pair interface for all cryptographic key types
 */
export interface KeyPair {
  privateKey: string;
  publicKey: string;
  type: KeyType;
}

/**
 * Key encoding formats
 */
export type KeyFormat = "pem" | "hex" | "base64";

/**
 * Generate a cryptographic key pair
 * @param type The type of key to generate
 * @param options Optional configuration for key generation
 * @returns A key pair object containing the private and public keys
 * @throws Error if the key type is unsupported
 */
export function generateKeyPair(type: KeyType, options?: { format?: KeyFormat }): KeyPair {
  const format = options?.format || "pem";
  
  try {
    switch (type) {
      case "rsa":
        return generateRsaKeyPair(format);
      case "ed25519":
        return generateEd25519KeyPair(format);
      case "x25519":
        return generateX25519KeyPair(format);
      case "secp256k1":
        return generateSecp256k1KeyPair(format);
      case "wireguard":
        return generateWireguardKeyPair();
      default:
        throw new Error(`Unsupported key type: ${type}`);
    }
  } catch (error) {
    throw new Error(`Failed to generate ${type} key pair: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate RSA key pair (2048-bit)
 */
function generateRsaKeyPair(format: KeyFormat): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { 
    publicKey: publicKey.toString(), 
    privateKey: privateKey.toString(), 
    type: "rsa" 
  };
}

/**
 * Generate Ed25519 key pair (digital signatures)
 */
function generateEd25519KeyPair(format: KeyFormat): KeyPair {
  if (format === "hex" || format === "base64") {
    // For hex/base64 format, we'll use DER generation and extract the raw bytes
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "der" },
      privateKeyEncoding: { type: "pkcs8", format: "der" },
    });
    
    // Extract raw 32-byte keys from DER format
    const privateKeyRaw = Buffer.from(privateKey).subarray(-32); // Last 32 bytes
    const publicKeyRaw = Buffer.from(publicKey).subarray(-32); // Last 32 bytes
    
    return {
      privateKey: format === "base64" ? privateKeyRaw.toString("base64") : privateKeyRaw.toString("hex"),
      publicKey: format === "base64" ? publicKeyRaw.toString("base64") : publicKeyRaw.toString("hex"),
      type: "ed25519"
    };
  }
  
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { 
    publicKey: publicKey.toString(), 
    privateKey: privateKey.toString(), 
    type: "ed25519" 
  };
}

/**
 * Generate X25519 key pair (key exchange, used by WireGuard)
 */
function generateX25519KeyPair(format: KeyFormat): KeyPair {
  if (format === "hex" || format === "base64") {
    // For hex/base64 format, we'll use DER generation and extract the raw bytes
    const { publicKey, privateKey } = crypto.generateKeyPairSync("x25519", {
      publicKeyEncoding: { type: "spki", format: "der" },
      privateKeyEncoding: { type: "pkcs8", format: "der" },
    });
    
    // Extract raw 32-byte keys from DER format
    const privateKeyRaw = Buffer.from(privateKey).subarray(-32); // Last 32 bytes
    const publicKeyRaw = Buffer.from(publicKey).subarray(-32); // Last 32 bytes
    
    return {
      privateKey: format === "base64" ? privateKeyRaw.toString("base64") : privateKeyRaw.toString("hex"),
      publicKey: format === "base64" ? publicKeyRaw.toString("base64") : publicKeyRaw.toString("hex"),
      type: "x25519"
    };
  }
  
  const { publicKey, privateKey } = crypto.generateKeyPairSync("x25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { 
    publicKey: publicKey.toString(), 
    privateKey: privateKey.toString(), 
    type: "x25519" 
  };
}

/**
 * Generate secp256k1 key pair (Bitcoin/Ethereum style)
 */
function generateSecp256k1KeyPair(format: KeyFormat): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "secp256k1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { 
    publicKey: publicKey.toString(), 
    privateKey: privateKey.toString(), 
    type: "secp256k1" 
  };
}

/**
 * Generate WireGuard-compatible key pair (X25519 with base64 encoding)
 */
function generateWireguardKeyPair(): KeyPair {
  // WireGuard uses X25519 keys in base64 format
  const { publicKey, privateKey } = crypto.generateKeyPairSync("x25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  
  // Extract raw 32-byte keys from DER format for WireGuard compatibility
  const privateKeyRaw = Buffer.from(privateKey).subarray(-32); // Last 32 bytes
  const publicKeyRaw = Buffer.from(publicKey).subarray(-32); // Last 32 bytes
  
  return {
    privateKey: privateKeyRaw.toString("base64"),
    publicKey: publicKeyRaw.toString("base64"),
    type: "wireguard"
  };
}
/** 
 * Extract the public key from a private key
 * @param privateKey The private key in PEM or hex format
 * @returns The corresponding public key in the same format, or null if extraction fails
 */
export function derivePublicKey(privateKey: string): string | null {
  try {
    if (!privateKey) {
      return null;
    }
    
    // Check if it's PEM format
    if (privateKey.includes("-----BEGIN") && privateKey.includes("-----END")) {
      // Create a KeyObject from the private key PEM
      const privateKeyObj = crypto.createPrivateKey({
        key: privateKey,
        format: "pem",
      });

      // Derive the public key from the private key
      const publicKey = crypto.createPublicKey(privateKeyObj).export({
        type: "spki",
        format: "pem",
      });

      return publicKey.toString();
    }
    
    // hex: an Ed25519 seed (32 bytes). Wrap it in PKCS#8, then derive.
    if (/^[0-9a-fA-F]+$/.test(privateKey.trim())) {
      const pem = hexPrivateKeyToPem(privateKey.trim());
      if (!pem) {
        return null;
      }

      const privateKeyObj = crypto.createPrivateKey({ key: pem, format: "pem" });
      const publicDer = crypto.createPublicKey(privateKeyObj).export({
        type: "spki",
        format: "der",
      });

      // Ed25519 SPKI: 30 2a 30 05 06 03 2b 65 70 03 21 00 ‖ pub(32)
      return Buffer.from(publicDer).subarray(-32).toString("hex");
    }

    return null;
  } catch (error) {
    console.error("Failed to derive public key:", error);
    return null;
  }
}

/**
 * Compute a short identifier from a public key
 * @param publicKey The public key in PEM format
 * @returns A 16-character hexadecimal identifier
 */
export function getShortId(publicKey: string): string {
  const hash = crypto.createHash("sha256").update(publicKey).digest("hex");
  return hash.substring(0, 16);
}

/**
 * Compute a fingerprint from a public key
 * @param publicKey The public key in PEM format
 * @returns A 64-character hexadecimal fingerprint
 */
export function getFingerprint(publicKey: string): string {
  return crypto.createHash("sha256").update(publicKey).digest("hex");
}

/**
 * Key format conversion utilities
 */

/**
 * Convert PEM key to hex format
 * @param pemKey PEM formatted key
 * @returns Hex string or null if conversion fails
 */
export function pemToHex(pemKey: string): string | null {
  try {
    if (!pemKey || !pemKey.includes("-----BEGIN")) {
      return null;
    }
    
    // Import the PEM key and export as DER
    const keyObj = crypto.createPublicKey({
      key: pemKey,
      format: "pem",
    });
    
    const der = keyObj.export({
      type: "spki",
      format: "der",
    });
    
    // Extract the raw key bytes from DER format
    // For Ed25519 and X25519, the key is the last 32 bytes of the SPKI structure
    const derBuffer = Buffer.from(der);
    
    // SPKI structure for Ed25519: 30 2a 30 05 06 03 2b 65 70 03 21 00 [32 bytes key]
    // SPKI structure for X25519:  30 2a 30 05 06 03 2b 65 6e 03 21 00 [32 bytes key]
    // For these curves, we can extract the last 32 bytes
    if (derBuffer.length >= 32) {
      const keyBytes = derBuffer.subarray(-32);
      return keyBytes.toString("hex");
    }
    
    return null;
  } catch (error) {
    console.error("Failed to convert PEM to hex:", error);
    return null;
  }
}

/**
 * Convert PEM private key to hex format
 * @param pemKey The PEM-encoded private key
 * @returns Hex string or null if conversion fails
 */
export function pemPrivateKeyToHex(pemKey: string): string | null {
  try {
    if (!pemKey || !pemKey.includes("-----BEGIN PRIVATE KEY-----")) {
      return null;
    }
    
    // Import the PEM private key
    const privateKeyObj = crypto.createPrivateKey({
      key: pemKey,
      format: "pem",
    });
    
    // Export as DER format
    const der = privateKeyObj.export({
      type: "pkcs8",
      format: "der",
    });
    
    const derBuffer = Buffer.from(der);
    
    // For Ed25519 private keys, extract the 32-byte private key from PKCS8 DER
    // PKCS8 structure for Ed25519: ... [header] ... 04 20 [32 bytes private key]
    if (derBuffer.length >= 32) {
      // Find the OCTET STRING containing the private key (look for 04 20 pattern)
      for (let i = 0; i < derBuffer.length - 33; i++) {
        if (derBuffer[i] === 0x04 && derBuffer[i + 1] === 0x20) {
          const privateKeyBytes = derBuffer.subarray(i + 2, i + 34);
          return privateKeyBytes.toString("hex");
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Failed to convert PEM private key to hex:", error);
    return null;
  }
}

/**
 * Convert hex key to PEM format
 * @param hexKey Hex string key
 * @param keyType Key type for proper PEM formatting
 * @returns PEM formatted key or null if conversion fails
 */
export function hexToPem(hexKey: string, keyType: KeyType): string | null {
  try {
    if (!hexKey || !/^[0-9a-fA-F]+$/.test(hexKey)) {
      return null;
    }
    
    const keyBuffer = Buffer.from(hexKey, "hex");
    
    // For Ed25519 and X25519, we need to construct the proper DER format
    if (keyType === "ed25519" || keyType === "x25519") {
      // Create a proper DER-encoded public key
      const algorithmOID = keyType === "ed25519" 
        ? Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00])
        : Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x03, 0x21, 0x00]);
      
      const derKey = Buffer.concat([algorithmOID, keyBuffer]);
      
      const publicKeyObj = crypto.createPublicKey({
        key: derKey,
        format: "der",
        type: "spki",
      });
      
      return publicKeyObj.export({
        type: "spki",
        format: "pem",
      }).toString();
    }
    
    return null;
  } catch (error) {
    console.error("Failed to convert hex to PEM:", error);
    return null;
  }
}

/**
 * Convert base64 key to hex format
 * @param base64Key Base64 encoded key
 * @returns Hex string or null if conversion fails
 */
export function base64ToHex(base64Key: string): string | null {
  try {
    if (!base64Key) {
      return null;
    }
    
    // Validate base64 format first
    if (!isValidBase64(base64Key)) {
      return null;
    }
    
    const buffer = Buffer.from(base64Key, "base64");
    return buffer.toString("hex");
  } catch (error) {
    console.error("Failed to convert base64 to hex:", error);
    return null;
  }
}

/**
 * Convert hex key to base64 format
 * @param hexKey Hex string key
 * @returns Base64 encoded key or null if conversion fails
 */
export function hexToBase64(hexKey: string): string | null {
  try {
    if (!hexKey || !/^[0-9a-fA-F]+$/.test(hexKey)) {
      return null;
    }
    
    const buffer = Buffer.from(hexKey, "hex");
    return buffer.toString("base64");
  } catch (error) {
    console.error("Failed to convert hex to base64:", error);
    return null;
  }
}


/**
 * Detect key format
 * @param key Key in any format
 * @returns Detected format or null if unknown
 */
export function detectKeyFormat(key: string): KeyFormat | null {
  if (!key || typeof key !== "string") {
    return null;
  }
  
  // Check for PEM format
  if (key.includes("-----BEGIN") && key.includes("-----END")) {
    return "pem";
  }
  
  // Check for hex format
  if (/^[0-9a-fA-F]+$/.test(key.trim())) {
    return "hex";
  }
  
  // Check for base64 format (basic check)
  if (/^[A-Za-z0-9+/]+=*$/.test(key.trim())) {
    return "base64";
  }
  
  return null;
}

/**
 * Convert key to hex format regardless of input format
 * @param key Key in any format
 * @param keyType Key type (needed for PEM conversion)
 * @returns Hex string or null if conversion fails
 */
export function toHex(key: string, keyType?: KeyType): string | null {
  const format = detectKeyFormat(key);
  
  switch (format) {
    case "hex":
      return key.toLowerCase();
    case "base64":
      return base64ToHex(key);
    case "pem":
      return pemToHex(key);
    default:
      return null;
  }
}

/**
 * Convert Ed25519 private key from hex to PEM format
 * @param hexKey The hex-encoded private key (64 bytes: 32 private + 32 public)
 * @returns PEM formatted private key or null if conversion fails
 */
export function hexPrivateKeyToPem(hexKey: string): string | null {
  try {
    if (!hexKey || !/^[0-9a-fA-F]+$/.test(hexKey)) {
      return null;
    }
    
    // Ed25519 private keys are 64 bytes (32 private + 32 public)
    // Extract the private key part (first 32 bytes)
    const privateKeyBytes = Buffer.from(hexKey.substring(0, 64), 'hex');
    
    // Create PKCS8 DER format for Ed25519 private key
    const pkcs8Header = Buffer.from([
      0x30, 0x2e, // SEQUENCE, 46 bytes
      0x02, 0x01, 0x00, // INTEGER version 0
      0x30, 0x05, // SEQUENCE, 5 bytes
      0x06, 0x03, 0x2b, 0x65, 0x70, // OID for Ed25519
      0x04, 0x22, // OCTET STRING, 34 bytes
      0x04, 0x20 // OCTET STRING, 32 bytes (the actual private key)
    ]);
    
    const derKey = Buffer.concat([pkcs8Header, privateKeyBytes]);
    
    // Create private key object and export as PEM
    const privateKeyObj = crypto.createPrivateKey({
      key: derKey,
      format: 'der',
      type: 'pkcs8'
    });
    
    return privateKeyObj.export({
      type: 'pkcs8',
      format: 'pem'
    }).toString();
  } catch (error) {
    console.error("Failed to convert hex private key to PEM:", error);
    return null;
  }
}