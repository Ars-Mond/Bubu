/* Bubu cipher: browser port of exmaple/bubu_cipher.py.
 *
 * encode() produces exactly the same output as the Python script.
 * decode() is strict: instead of silently dropping what it cannot read,
 * it reports the first spot that could not have come out of encode().
 */
(function (root) {
  "use strict";

  const ABC = "оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё"; // Russian letters sorted by frequency
  const END = ABC.length;                           // padding marker for odd-length words
  const C = "пткбдгмнлрсзшхвф";                     // 16 consonants
  const V = "аоуиеыяю";                             // 8 vowels
  const RU = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";   // for turning a key word into shifts
  const WORD = /[а-яё]+/giu;

  const indexMap = (s) => new Map([...s].map((ch, i) => [ch, i]));
  const C_INDEX = indexMap(C);
  const V_INDEX = indexMap(V);
  const ABC_INDEX = indexMap(ABC);
  const RU_INDEX = indexMap(RU);

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

  function syl(n) {
    // 0..127 -> CV (2 chars), 128.. -> CCV (3 chars)
    if (n < 128) return C[n >> 3] + V[n & 7];
    n -= 128;
    return C[n >> 7] + C[(n >> 3) & 15] + V[n & 7];
  }

  function unsyl(s) {
    if (s.length === 2) return C_INDEX.get(s[0]) * 8 + V_INDEX.get(s[1]);
    return 128 + C_INDEX.get(s[0]) * 128 + C_INDEX.get(s[1]) * 8 + V_INDEX.get(s[2]);
  }

  function encWord(w) {
    const idx = [...w.toLowerCase()].map((ch) => ABC_INDEX.get(ch));
    idx.push(END);
    let out = "";
    for (let i = 0; i + 1 < idx.length; i += 2) out += syl(pairToN(idx[i], idx[i + 1]));
    return isUpper(w[0]) ? capitalize(out) : out;
  }

  // Returns { text } or { error: { code, at, length } } with `at` relative to the word.
  function decWord(w) {
    const lo = w.toLowerCase();
    const fail = (code, at, length = 1) => ({ error: { code, at, length } });
    let out = "";
    let i = 0;
    while (i < lo.length) {
      const start = i;
      while (i < lo.length && C_INDEX.has(lo[i])) i++;
      const consonants = i - start;

      if (i === lo.length) return fail("tail", start, consonants);
      if (!V_INDEX.has(lo[i])) return fail("letter", i);
      if (consonants === 0) return fail("vowel", i);
      if (consonants > 2) return fail("cluster", start, consonants);

      i++;
      const [a, b] = nToPair(unsyl(lo.slice(start, i)));
      if (a >= END || b > END) return fail("range", start, i - start);
      if (b === END && i < lo.length) return fail("marker", start, i - start);
      out += ABC[a] + (b < END ? ABC[b] : "");
    }
    return { text: isUpper(w[0]) ? capitalize(out) : out };
  }

  // ---------- shift layer (Caesar / Vigenere on consonants) ----------

  function shift(text, shifts, sign) {
    let i = 0;
    let out = "";
    for (const ch of text) {
      const lo = ch.toLowerCase();
      const c = C_INDEX.get(lo);
      if (c === undefined) {
        out += ch;
        continue;
      }
      const moved = C[mod(c + sign * shifts[i % shifts.length], C.length)];
      out += isUpper(ch) ? moved.toUpperCase() : moved;
      i++;
    }
    return out;
  }

  // ---------- public API ----------

  // "" -> no shift, integer -> Caesar, Russian word -> Vigenere (а=0, б=1, ...).
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
    if (letters.every((ch) => RU_INDEX.has(ch))) {
      return { kind: "vigenere", shifts: letters.map((ch) => RU_INDEX.get(ch)), label: s };
    }
    return null;
  }

  function encode(text, shifts = [0]) {
    return shift(text.replace(WORD, encWord), shifts, +1);
  }

  // Returns { text } or { error: { code, index, length, wordIndex, wordLength } }.
  // Indices point into the original `text` (the shift layer keeps positions intact).
  function decode(text, shifts = [0]) {
    const plain = shift(text, shifts, -1);
    let error = null;
    const out = plain.replace(WORD, (w, offset) => {
      if (error) return w;
      const r = decWord(w);
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
