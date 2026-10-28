// Strict YAML subset. No dependencies.
//
// Accepted: # comments, two-space mappings, sequences (incl. sequences of mappings),
// inline scalar arrays, quoted strings, integers, decimals, true/false/null.
//
// Rejected loudly: tabs, odd indentation, flow mappings, anchors, block scalars,
// multi-document, duplicate keys. A file that cannot mean two things is the point.

const KEY = /^("(?:[^"\\]|\\.)*"|'[^']*'|[A-Za-z0-9_.@-]+):(?: (.*))?$/;

// Keys may be bare or quoted. A JSON-shaped document has `@context`, `$schema` and similar, so a
// bare-key character class that stops at [A-Za-z0-9_.-] cannot hold one.
const unquoteKey = (raw) =>
  raw.startsWith('"')
    ? JSON.parse(raw)
    : raw.startsWith("'")
      ? raw.slice(1, -1).replace(/''/g, "'")
      : raw;

export function parseYaml(source) {
  const lines = tokenize(source);
  if (lines.length === 0) return null;
  const [value, next] = parseBlock(lines, 0, lines[0].indent);
  if (next !== lines.length) throw new Error(at(lines[next], "unexpected content"));
  return value;
}

function tokenize(source) {
  const out = [];
  source.split(/\r?\n/).forEach((raw, index) => {
    const lineNo = index + 1;
    const text = stripComment(raw);
    if (text.trim() === "") return;
    if (/^\t/.test(text)) throw new Error(`line ${lineNo}: tabs are not allowed, use two spaces`);
    const indent = text.length - text.trimStart().length;
    if (indent % 2 !== 0) throw new Error(`line ${lineNo}: indent must be a multiple of two`);
    out.push({ indent, text: text.trimStart(), line: lineNo });
  });
  return out;
}

function stripComment(line) {
  let single = false;
  let double = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !double) single = !single;
    else if (ch === '"' && !single) double = !double;
    else if (ch === "#" && !single && !double && (i === 0 || line[i - 1] === " ")) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseBlock(lines, i, indent) {
  return lines[i].text === "- " || lines[i].text.startsWith("- ")
    ? parseSequence(lines, i, indent)
    : parseMapping(lines, i, indent);
}

function parseMapping(lines, i, indent) {
  const out = {};
  while (i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith("- ")) {
    const entry = lines[i];
    const matched = entry.text.match(KEY);
    if (!matched) throw new Error(at(entry, 'expected "key: value"'));
    const key = unquoteKey(matched[1]);
    if (Object.hasOwn(out, key)) throw new Error(at(entry, `duplicate key "${key}"`));
    const [value, next] = parseEntryValue(lines, i, indent, matched[2], entry);
    out[key] = value;
    i = next;
  }
  if (i < lines.length && lines[i].indent > indent) {
    throw new Error(at(lines[i], "unexpected indentation"));
  }
  return [out, i];
}

function parseSequence(lines, i, indent) {
  const out = [];
  while (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith("- ")) {
    const body = lines[i].text.slice(2);
    const matched = body.match(KEY);
    if (!matched) {
      out.push(parseScalar(body, lines[i]));
      i += 1;
      continue;
    }
    const map = {};
    const key = unquoteKey(matched[1]);
    const [value, next] = parseEntryValue(lines, i, indent, matched[2], lines[i]);
    map[key] = value;
    i = next;
    while (i < lines.length && lines[i].indent === indent + 2 && !lines[i].text.startsWith("- ")) {
      const cont = lines[i];
      const more = cont.text.match(KEY);
      if (!more) throw new Error(at(cont, 'expected "key: value"'));
      const moreKey = unquoteKey(more[1]);
      if (Object.hasOwn(map, moreKey)) throw new Error(at(cont, `duplicate key "${moreKey}"`));
      const [child, after] = parseEntryValue(lines, i, indent + 2, more[2], cont);
      map[moreKey] = child;
      i = after;
    }
    out.push(map);
  }
  if (i < lines.length && lines[i].indent > indent) {
    throw new Error(at(lines[i], "unexpected indentation"));
  }
  return [out, i];
}

// A `key:` with nothing after it may own a nested block on the following lines.
// `parentIndent` is the indent of the line the key sits on (sequence items sit two deeper).
function parseEntryValue(lines, i, parentIndent, rest, entry) {
  if (rest !== undefined && rest !== "") return [parseScalar(rest, entry), i + 1];
  const childIndent = Math.max(parentIndent, i >= 0 ? lines[i].indent : parentIndent);
  const nextLine = lines[i + 1];
  if (nextLine && nextLine.indent > childIndent) {
    return parseBlock(lines, i + 1, nextLine.indent);
  }
  return [null, i + 1];
}

function parseScalar(text, entry) {
  const value = text.trim();
  if (value === "") return null;
  if (value.startsWith('"')) {
    if (!value.endsWith('"') || value.length < 2) throw new Error(at(entry, "unterminated string"));
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(at(entry, "invalid double-quoted string"));
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) throw new Error(at(entry, "unterminated string"));
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith("[")) {
    if (!value.endsWith("]")) throw new Error(at(entry, "unterminated inline array"));
    const inner = value.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((part) => parseScalar(part, entry));
  }
  if (value.startsWith("{")) throw new Error(at(entry, "flow mappings are not supported"));
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d+\.\d+$/.test(value)) return Number(value);
  return value;
}

function at(entry, message) {
  return `line ${entry.line}: ${message} (in "${entry.text}")`;
}
