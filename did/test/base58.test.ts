import { describe, expect, it } from "vitest";
import { base58btcDecode, base58btcEncode } from "../src/base58.js";

const bytes = (...values: number[]) => Uint8Array.from(values);
const hex = (value: Uint8Array) => Buffer.from(value).toString("hex");

describe("base58btc", () => {
  it("encodes empty input as empty", () => {
    expect(base58btcEncode(bytes())).toBe("");
  });

  it("keeps leading zero bytes as '1'", () => {
    expect(base58btcEncode(bytes(0))).toBe("1");
    expect(base58btcEncode(bytes(0, 0))).toBe("11");
    expect(base58btcEncode(bytes(0, 1))).toBe("12");
    expect(base58btcEncode(bytes(0, 0, 1))).toBe("112");
  });

  it("decodes leading '1's back to zero bytes", () => {
    expect(hex(base58btcDecode("1"))).toBe("00");
    expect(hex(base58btcDecode("11"))).toBe("0000");
    // "112" is two leading '1's (zero bytes) followed by '2' (0x01)
    expect(hex(base58btcDecode("112"))).toBe("000001");
  });

  it("round-trips arbitrary bytes", () => {
    for (let trial = 0; trial < 200; trial++) {
      const length = 1 + Math.floor(Math.random() * 48);
      const input = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        input[i] = Math.floor(Math.random() * 256);
      }
      expect(hex(base58btcDecode(base58btcEncode(input)))).toBe(hex(input));
    }
  });

  it("throws on characters outside the alphabet", () => {
    for (const bad of ["0", "O", "I", "l", " ", "+"]) {
      expect(() => base58btcDecode(bad)).toThrow(/invalid character/);
    }
  });
});
