// In test/fixtures/keys.ts
import { generateKeyPair } from '../../src/keys.js';
// Generate once and export
const rsaKeyPair = generateKeyPair('rsa');
const ed25519KeyPair = generateKeyPair('ed25519');

export const testMessage = 'Synet is rising.';

export const keyPairs = {
    rsa: rsaKeyPair,
    ed25519: ed25519KeyPair,
}