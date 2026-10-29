#!/usr/bin/env node
// The wire between the runner and @synthetism/did.
//
// One JSON object on stdin, one JSON object on stdout, nothing else.
// Byte arrays cross the wire as hex strings (see BRIEF.md, "The wire").
// A thrown error crosses as data: { "throws": "<message>" }.

import {
  base58btcDecode,
  base58btcEncode,
  didKeyFromPublicKey,
  isDidKey,
  publicKeyFromDidKey,
} from "../dist/index.js";

const input = JSON.parse(
  await new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  }),
);

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

let out;
try {
  switch (input.operation) {
    case "didKeyFromPublicKey":
      out = { did: didKeyFromPublicKey(input.publicKeyHex) };
      break;
    case "publicKeyFromDidKey":
      out = { publicKeyHex: publicKeyFromDidKey(input.did) };
      break;
    case "isDidKey":
      out = { result: isDidKey(input.value) };
      break;
    case "base58btcEncode":
      out = { encoded: base58btcEncode(hexToBytes(input.bytesHex)) };
      break;
    case "base58btcDecode":
      out = { bytesHex: bytesToHex(base58btcDecode(input.encoded)) };
      break;
    default:
      out = { throws: `unknown operation: ${JSON.stringify(input.operation)}` };
  }
} catch (error) {
  out = { throws: error.message };
}

process.stdout.write(`${JSON.stringify(out)}\n`);
