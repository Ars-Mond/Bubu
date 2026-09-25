/* Bubu cipher: browser port of exmaple/bubu_cipher.py.
 *
 * Every word keeps its script: Russian words become Cyrillic syllables,
 * English words become Latin ones.
 *
 * encode() produces exactly the same output as the Python script.
 * decode() is strict: instead of silently dropping what it cannot read,
 * it reports the first spot that could not have come out of encode().
 */
(function (root) {
  "use strict";

  const indexMap = (s) => new Map([...s].map((ch, i) => [ch, i]));

  function lang(abc, cons, vows, order) {
    return {
      abc,                         // letters sorted by frequency
      end: abc.length,             // padding marker for odd-length words
      cons,                        // 16 consonants
      vows,                        // vowels
      order,                       // alphabet order, for turning a key word into shifts
      abcIndex: indexMap(abc),
      consIndex: indexMap(cons),
      vowsIndex: indexMap(vows),
    };
  }

  const RU = lang(
    "оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё",
    "пткбдгмнлрсзшхвф",
    "аоуиеыяю",
    "абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
  );
  const EN = lang(
    "etaoinshrdlcumwfgypbvkjxqz",
    "ptkbdgmnlrszwhvf", // Latin counterparts of the Russian consonants
    "aouiey",
    "abcdefghijklmnopqrstuvwxyz",
  );
  const WORD = /([А-Яа-яЁё]+)|[A-Za-z]+/g; // group 1 is set for Russian words

  // Consonant in either case -> { lang, index }, for the shift layer.
  const CONS = new Map();
  for (const l of [RU, EN]) {
    [...l.cons].forEach((c, i) => {
      CONS.set(c, { lang: l, index: i });
      CONS.set(c.toUpperCase(), { lang: l, index: i });
    });
  }
  // Key letter -> shift (а/a = 0, б/b = 1, ...).
  const KEY = new Map([...indexMap(EN.order), ...indexMap(RU.order)]);

  const mod = (a, n) => ((a % n) + n) % n;
  const isUpper = (ch) => ch !== ch.toLowerCase();
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  // ---------- syllable layer ----------

  function pairToN(a, b) {
    // "square shells": pairs of frequent letters get small numbers -> short syllables
    const m = Math.max(a, b);
    return m * m + (a === m ? b : m + 1 + a);
  }

  function nToPair(n) {
    let m = Math.floor(Math.sqrt(n));
    while (m * m > n) m--;
    while ((m + 1) * (m + 1) <= n) m++;
    const r = n - m * m;
    return r <= m ? [m, r] : [r - m - 1, m];
  }

  function syl(n, l) {
    // below |C|*|V| -> CV (2 chars), above -> CCV (3 chars)
    const nc = l.cons.length;
    const nv = l.vows.length;
    if (n < nc * nv) return l.cons[Math.floor(n / nv)] + l.vows[n % nv];
    n -= nc * nv;
    return l.cons[Math.floor(n / (nc * nv))] + l.cons[Math.floor(n / nv) % nc] + l.vows[n % nv];
  }

  function unsyl(s, l) {
    const nv = l.vows.length;
    const n = l.consIndex.get(s[s.length - 2]) * nv + l.vowsIndex.get(s[s.length - 1]);
    return s.length === 2 ? n : l.cons.length * nv * (1 + l.consIndex.get(s[0])) + n;
  }

  function encWord(w, l) {
    const idx = [...w.toLowerCase()].map((ch) => l.abcIndex.get(ch));
    idx.push(l.end);
    let out = "";
    for (let i = 0; i + 1 < idx.length; i += 2) out += syl(pairToN(idx[i], idx[i + 1]), l);
    return isUpper(w[0]) ? capitalize(out) : out;
  }

  // Returns { text } or { error: { code, at, length } } with `at` relative to the word.
  function decWord(w, l) {
    const lo = w.toLowerCase();
    const fail = (code, at, length = 1) => ({ error: { code, at, length } });
    let out = "";
    let i = 0;
    while (i < lo.length) {
      const start = i;
      while (i < lo.length && l.consIndex.has(lo[i])) i++;
      const consonants = i - start;

      if (i === lo.length) return fail("tail", start, consonants);
      if (!l.vowsIndex.has(lo[i])) return fail("letter", i);
      if (consonants === 0) return fail("vowel", i);
      if (consonants > 2) return fail("cluster", start, consonants);

      i++;
      const [a, b] = nToPair(unsyl(lo.slice(start, i), l));
      if (a >= l.end || b > l.end) return fail("range", start, i - start);
      if (b === l.end && i < lo.length) return fail("marker", start, i - start);
      out += l.abc[a] + (b < l.end ? l.abc[b] : "");
    }
    return { text: isUpper(w[0]) ? capitalize(out) : out };
  }

  // ---------- shift layer (Caesar / Vigenere on consonants) ----------

  function shift(text, shifts, sign) {
    let i = 0;
    let out = "";
    for (const ch of text) {
      const c = CONS.get(ch);
      if (!c) {
        out += ch;
        continue;
      }
      const moved = c.lang.cons[mod(c.index + sign * shifts[i % shifts.length], c.lang.cons.length)];
      out += isUpper(ch) ? moved.toUpperCase() : moved;
      i++;
    }
    return out;
  }

  // ---------- public API ----------

  // "" -> no shift, integer -> Caesar, word of Russian/English letters -> Vigenere.
  // Returns null when the key is neither.
  function parseKey(raw) {
    const s = String(raw).trim();
    if (s === "") return { kind: "none", shifts: [0] };
    if (/^[+-]?\d+$/.test(s)) {
      // Reduce with BigInt so huge shifts match Python's arbitrary-precision ints.
      const k = Number(((BigInt(s) % 16n) + 16n) % 16n);
      return { kind: "caesar", shifts: [k], label: s };
    }
    const letters = [...s.toLowerCase()];
    if (letters.every((ch) => KEY.has(ch))) {
      return { kind: "vigenere", shifts: letters.map((ch) => KEY.get(ch)), label: s };
    }
    return null;
  }

  function encode(text, shifts = [0]) {
    return shift(text.replace(WORD, (w, ru) => encWord(w, ru ? RU : EN)), shifts, +1);
  }

  // Returns { text } or { error: { code, index, length, wordIndex, wordLength } }.
  // Indices point into the original `text` (the shift layer keeps positions intact).
  function decode(text, shifts = [0]) {
    const plain = shift(text, shifts, -1);
    let error = null;
    const out = plain.replace(WORD, (w, ru, offset) => {
      if (error) return w;
      const r = decWord(w, ru ? RU : EN);
      if (!r.error) return r.text;
      error = {
        code: r.error.code,
        index: offset + r.error.at,
        length: r.error.length,
        wordIndex: offset,
        wordLength: w.length,
      };
      return w;
    });
    return error ? { error } : { text: out };
  }

  const api = { encode, decode, parseKey };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Bubu = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
