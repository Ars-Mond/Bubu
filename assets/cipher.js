/* Bubu cipher: browser port of exmaple/bubu_cipher.py.
 *
 * Languages are detected per word: Cyrillic -> Russian, Latin -> English.
 * v1 (classic): letter pairs -> CV / CCV syllables.
 * v2 (cute): soft syllables with tails (пан, мяу / pan, piu), with optional
 *   easy clusters and song-like rhythm.
 *
 * encode() produces exactly the same output as the Python script.
 * decode() is strict: instead of silently dropping what it cannot read,
 * it reports the first spot that could not have come out of encode().
 */
(function (root) {
  "use strict";

  const indexMap = (s) => new Map([...s].map((ch, i) => [ch, i]));
  const mod = (a, n) => ((a % n) + n) % n;
  const isUpper = (ch) => ch !== ch.toLowerCase();
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const isSep = (ch) => ch === " " || ch === "-";

  const CAP = "^"; // internal v2 marker: next letter is uppercase

  function freqMap(symbols, weights) {
    const list = [...symbols];
    return { symbols: list, weight: new Map(list.map((ch, i) => [ch, weights[i]])) };
  }

  function lang(id, spec) {
    return {
      id,
      ...spec,
      end: spec.abc.length, // v1 padding marker for odd-length words
      abcIndex: indexMap(spec.abc),
      consIndex: indexMap(spec.cons),
      vowsIndex: indexMap(spec.vows),
      bad: new Set(spec.bad),
      cute: new Set(spec.ons2.join("") + spec.vow + spec.tail.join("")), // all letters of v2 output
    };
  }

  // Order matters: it is the capture group order of the word regexes below.
  const LANGS = [
    lang("ru", {
      letters: "абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
      // v1: letters by frequency, 16 consonants, 8 vowels
      abc: "оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё", cons: "пткбдгмнлрсзшхвф", vows: "аоуиеыяю",
      // v2: soft onsets (cutest first), onsets with clusters, vowels, tails, banned vowel+tail
      ons1: [..."пмбтлндкрв"],
      ons2: ["п", "пр", "м", "б", "бр", "т", "тр", "л", "кл", "н", "д", "пл", "к", "р", "в"],
      vow: "аиуояю", tail: ["", "у", "н", "м", "й"], bad: ["уу", "юу"],
      freq: freqMap(" оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё-" + CAP, [
        200, 110, 85, 80, 74, 67, 63, 55, 47, 45, 44, 35, 32, 30, 28, 26, 20, 19,
        17, 17, 16, 16, 14, 12, 10, 9, 7, 6, 5, 4, 3, 3, 1, 1, 2, 3]),
    }),
    lang("en", {
      letters: "abcdefghijklmnopqrstuvwxyz",
      abc: "etaoinshrdlcumwfgypbvkjxqz", cons: "ptkbdgmnlrszfvhw", vows: "aeiouy",
      ons1: [..."pmbtlndkrw"],
      ons2: ["p", "pr", "m", "b", "br", "t", "tr", "l", "bl", "n", "d", "pl", "k", "r", "w"],
      vow: "aiuoe", tail: ["", "u", "n", "m", "y"], bad: ["uu"],
      freq: freqMap(" etaoinshrdlcumwfgypbvkjxqz-" + CAP, [
        200, 127, 91, 82, 75, 70, 67, 63, 61, 60, 43, 40, 28, 28, 24, 24, 22, 20,
        20, 19, 15, 10, 8, 2, 2, 1, 1, 2, 3]),
    }),
  ];

  // One capture group per language; rhythm mode also joins words by single " " or "-".
  const WORDS = /([А-Яа-яЁё]+)|([A-Za-z]+)/g;
  const PHRASES = /([А-Яа-яЁё]+(?:[ -][А-Яа-яЁё]+)*)|([A-Za-z]+(?:[ -][A-Za-z]+)*)/g;
  const langOf = (groups) => LANGS[groups.findIndex((g) => g !== undefined)];

  // ---------- key ----------

  const KEY = new Map([...indexMap(LANGS[1].letters), ...indexMap(LANGS[0].letters)]);

  // "" -> no key, integer -> Caesar, word of Russian/English letters -> Vigenere
  // (а/a = 0, б/b = 1, ...). Returns null when the key is neither.
  function parseKey(raw) {
    const s = String(raw).trim();
    if (s === "") return { kind: "none", values: [0n] };
    if (/^[+-]?\d+$/.test(s)) return { kind: "caesar", values: [BigInt(s)], label: s };
    const values = [...s.toLowerCase()].map((ch) => KEY.get(ch));
    if (values.some((v) => v === undefined)) return null;
    return { kind: "vigenere", values: values.map(BigInt), label: s };
  }

  // Key values reduced to 0..n-1; BigInt keeps huge shifts exact, like Python ints.
  function shiftsMod(key, n) {
    const bn = BigInt(n);
    return (key ? key.values : [0n]).map((k) => Number(((k % bn) + bn) % bn));
  }

  // =====================================================================
  //  v1: classic
  // =====================================================================

  // Lowercase consonant -> { L, index }, for the shift layer.
  const CONS = new Map();
  for (const L of LANGS) [...L.cons].forEach((c, index) => CONS.set(c, { L, index }));

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

  function syl(n, L) {
    // small n -> CV (2 chars), the rest -> CCV (3 chars)
    const nc = L.cons.length;
    const nv = L.vows.length;
    if (n < nc * nv) return L.cons[Math.floor(n / nv)] + L.vows[n % nv];
    n -= nc * nv;
    return L.cons[Math.floor(n / (nc * nv))] + L.cons[Math.floor(n / nv) % nc] + L.vows[n % nv];
  }

  function unsyl(s, L) {
    const nv = L.vows.length;
    const n = L.consIndex.get(s[s.length - 2]) * nv + L.vowsIndex.get(s[s.length - 1]);
    return s.length === 2 ? n : L.cons.length * nv * (1 + L.consIndex.get(s[0])) + n;
  }

  function v1EncWord(w, L) {
    const idx = [...w.toLowerCase()].map((ch) => L.abcIndex.get(ch));
    idx.push(L.end);
    let out = "";
    for (let i = 0; i + 1 < idx.length; i += 2) out += syl(pairToN(idx[i], idx[i + 1]), L);
    return isUpper(w[0]) ? capitalize(out) : out;
  }

  // Returns { text } or { error: { code, at, length } } with `at` relative to the word.
  function v1DecWord(w, L) {
    const lo = w.toLowerCase();
    const fail = (code, at, length = 1) => ({ error: { code, at, length } });
    let out = "";
    let i = 0;
    while (i < lo.length) {
      const start = i;
      while (i < lo.length && L.consIndex.has(lo[i])) i++;
      const consonants = i - start;

      if (i === lo.length) return fail("tail", start, consonants);
      if (!L.vowsIndex.has(lo[i])) return fail("letter", i);
      if (consonants === 0) return fail("vowel", i);
      if (consonants > 2) return fail("cluster", start, consonants);

      i++;
      const [a, b] = nToPair(unsyl(lo.slice(start, i), L));
      if (a >= L.end || b > L.end) return fail("range", start, i - start);
      if (b === L.end && i < lo.length) return fail("marker", start, i - start);
      out += L.abc[a] + (b < L.end ? L.abc[b] : "");
    }
    return { text: isUpper(w[0]) ? capitalize(out) : out };
  }

  // Caesar / Vigenere on consonants over the whole text. Like the script, any
  // character whose lowercase form is a consonant counts (even the Kelvin sign).
  function v1Shift(text, shifts, sign) {
    let i = 0;
    let out = "";
    for (const ch of text) {
      const lo = ch.toLowerCase();
      const c = lo.length === 1 ? CONS.get(lo) : undefined;
      if (!c) {
        out += ch;
        continue;
      }
      const moved = c.L.cons[mod(c.index + sign * shifts[i % shifts.length], c.L.cons.length)];
      out += isUpper(ch) ? moved.toUpperCase() : moved;
      i++;
    }
    return out;
  }

  function v1Encode(text, { key }) {
    const words = text.replace(WORDS, (w, ...groups) => v1EncWord(w, langOf(groups.slice(0, 2))));
    return v1Shift(words, shiftsMod(key, 16), +1);
  }

  function v1Decode(text, { key }) {
    const plain = v1Shift(text, shiftsMod(key, 16), -1);
    return decodeWords(plain, WORDS, (w, L) => v1DecWord(w, L));
  }

  // =====================================================================
  //  v2: cute
  //  Syllable = onset + vowel + optional tail. Every syllable starts with a
  //  consonant, so parsing is unambiguous. Text is packed as 3 symbols ->
  //  2 syllables (frequent triples get the shortest syllables); a 1-2 symbol
  //  remainder uses 1 or 2 syllables.
  // =====================================================================

  const RHYTHM = [2, 3, 1, 2, 2, 3]; // syllables per chunk in rhythm mode
  const tableCache = new Map();

  function tables(L, clusters, rhythm) {
    const id = `${L.id}${+clusters}${+rhythm}`;
    if (tableCache.has(id)) return tableCache.get(id);

    const ons = clusters ? L.ons2 : L.ons1;
    // cost: a cluster counts as half an extra letter, so clusters show up often enough
    const cost = ([o, , t]) => 0.5 + 0.5 * ons[o].length + L.tail[t].length;

    const combos = [];
    for (let o = 0; o < ons.length; o++) {
      for (let v = 0; v < L.vow.length; v++) {
        for (let t = 0; t < L.tail.length; t++) {
          if (!L.bad.has(L.vow[v] + L.tail[t])) combos.push([o, v, t]); // no "пуу", "puu"
        }
      }
    }
    // Explicit index tie-breaks reproduce Python's stable sorts.
    const syls = combos
      .map((s, i) => ({ s, c: cost(s), sum: s[0] + s[1] + s[2], i }))
      .sort((x, y) => x.c - y.c || x.sum - y.sum || x.i - y.i)
      .map((d) => d.s);
    const S = syls.length;
    const costs = syls.map(cost);

    // symbols: letters + CAP (+ space and hyphen in rhythm mode, where words are merged)
    const alpha = L.freq.symbols.filter((ch) => rhythm || !isSep(ch));
    const total = alpha.reduce((sum, ch) => sum + L.freq.weight.get(ch), 0);
    const p = alpha.map((ch) => L.freq.weight.get(ch) / total);
    const q = rhythm ? 0.05 : 0.2; // rough weight of a 2-symbol remainder
    const units = [];
    const weights = [];
    for (let a = 0; a < alpha.length; a++) {
      for (let b = 0; b < alpha.length; b++) {
        units.push(alpha[a] + alpha[b]);
        weights.push(-(p[a] * p[b]) * q);
      }
    }
    for (let a = 0; a < alpha.length; a++) {
      for (let b = 0; b < alpha.length; b++) {
        for (let c = 0; c < alpha.length; c++) {
          units.push(alpha[a] + alpha[b] + alpha[c]);
          weights.push(-(p[a] * p[b] * p[c]));
        }
      }
    }
    const unitOrder = units.map((_, i) => i)
      .sort((x, y) => (weights[x] < weights[y] ? -1 : weights[x] > weights[y] ? 1 : x - y));

    // Only as many syllable pairs as there are units are ever used.
    const pairs = Array.from({ length: S * S }, (_, i) => i).sort((x, y) => {
      const ax = Math.floor(x / S), bx = x % S, ay = Math.floor(y / S), by = y % S;
      return costs[ax] + costs[bx] - (costs[ay] + costs[by]) || ax + bx - (ay + by) || x - y;
    });
    const enc = new Map();
    const dec = new Map();
    unitOrder.forEach((u, i) => {
      enc.set(units[u], pairs[i]);
      dec.set(pairs[i], units[u]);
    });

    const singles = alpha.map((ch, i) => ({ ch, i }))
      .sort((x, y) => L.freq.weight.get(y.ch) - L.freq.weight.get(x.ch) || x.i - y.i)
      .map((d) => d.ch);

    const sylKey = (o, v, t) => (o * L.vow.length + v) * L.tail.length + t;
    const T = {
      L,
      ons,
      onsIndex: new Map(ons.map((o, i) => [o, i])),
      onsLongestFirst: ons.map((o, i) => ({ o, i })).sort((x, y) => y.o.length - x.o.length || x.i - y.i).map((d) => d.o),
      vowelTails: new Set(L.tail.filter((t) => t && L.vow.includes(t))),    // always a tail
      consonantTails: new Set(L.tail.filter((t) => t && !L.vow.includes(t))), // not before a vowel
      syls,
      text: syls.map(([o, v, t]) => ons[o] + L.vow[v] + L.tail[t]),
      sylKey,
      idx: new Map(syls.map(([o, v, t], i) => [sylKey(o, v, t), i])),
      enc,
      dec,
      singles,
      singlesIndex: new Map(singles.map((ch, i) => [ch, i])),
    };
    tableCache.set(id, T);
    return T;
  }

  function rhythmJoin(parts) {
    let out = "";
    for (let i = 0, k = 0; i < parts.length; k++) {
      const n = RHYTHM[k % RHYTHM.length];
      if (out) out += k % 3 === 1 ? "-" : " ";
      out += parts.slice(i, i + n).join("");
      i += n;
    }
    return out;
  }

  function v2EncSeg(seg, T, ks, counter, rhythm) {
    const S = T.syls.length;
    const n = T.ons.length;
    // first capital is shown by output case, the others are coded with CAP
    const sym = [];
    [...seg].forEach((ch, i) => {
      if (i && isUpper(ch)) sym.push(CAP);
      sym.push(ch.toLowerCase());
    });
    const ids = [];
    for (let i = 0; i < sym.length; i += 3) {
      const g = sym.slice(i, i + 3);
      if (g.length === 1) {
        ids.push(T.singlesIndex.get(g[0]));
      } else {
        const pair = T.enc.get(g.join(""));
        ids.push(Math.floor(pair / S), pair % S);
      }
    }
    const parts = ids.map((id) => {
      const [o, v, t] = T.syls[id];
      return T.text[T.idx.get(T.sylKey(mod(o + ks[counter.k++ % ks.length], n), v, t))];
    });
    const out = rhythm ? rhythmJoin(parts) : parts.join("");
    return isUpper(seg[0]) ? capitalize(out) : out;
  }

  // Mirrors the script's syllable regex at position p: onset (longest first) + vowel
  // + optional tail, where a consonant tail only counts when no vowel follows.
  function matchSyllable(s, p, T) {
    const vow = T.L.vow;
    for (const on of T.onsLongestFirst) {
      const v = s[p + on.length];
      if (!s.startsWith(on, p) || v === undefined || !vow.includes(v)) continue;
      const q = p + on.length + 1;
      const c = s[q];
      let tail = "";
      if (T.vowelTails.has(c)) tail = c;
      else if (T.consonantTails.has(c) && !(s[q + 1] && vow.includes(s[q + 1]))) tail = c;
      return { o: T.onsIndex.get(on), v: vow.indexOf(v), t: T.L.tail.indexOf(tail), from: p, to: q + tail.length };
    }
    return null;
  }

  function v2DecRun(run, T, ks, counter) {
    const L = T.L;
    // letters without the rhythm separators, with their positions in the run
    const pos = [];
    let s = "";
    for (let i = 0; i < run.length; i++) {
      if (isSep(run[i])) continue;
      pos.push(i);
      s += run[i].toLowerCase();
    }
    const fail = (code, from, to = from + 1) =>
      ({ error: { code, at: pos[from], length: pos[to - 1] + 1 - pos[from] } });

    for (let j = 0; j < s.length; j++) if (!L.cute.has(s[j])) return fail("letter", j);

    const found = [];
    for (let p = 0; p < s.length;) {
      const m = matchSyllable(s, p, T);
      if (!m) {
        if (L.vow.includes(s[p])) return fail("vowel", p);
        if (p + 1 === s.length) return fail("end", p);
        return fail("syllable", p, p + 2);
      }
      found.push(m);
      p = m.to;
    }

    const n = T.ons.length;
    const S = T.syls.length;
    const ids = [];
    for (const m of found) {
      const id = T.idx.get(T.sylKey(mod(m.o - ks[counter.k++ % ks.length], n), m.v, m.t));
      if (id === undefined) return fail("syllable", m.from, m.to); // e.g. "пуу"
      ids.push(id);
    }

    // symbols, each remembering the syllables it came from
    const sym = [];
    for (let i = 0; i < ids.length; i += 2) {
      if (i + 1 < ids.length) {
        const unit = T.dec.get(ids[i] * S + ids[i + 1]);
        const from = found[i].from;
        const to = found[i + 1].to;
        if (unit === undefined) return fail("pair", from, to);
        if (unit.length === 2 && i + 2 < ids.length) return fail("early", from, to);
        for (const ch of unit) sym.push({ ch, from, to });
      } else {
        const ch = T.singles[ids[i]];
        if (ch === undefined) return fail("single", found[i].from, found[i].to);
        sym.push({ ch, from: found[i].from, to: found[i].to });
      }
    }

    // canonical shape: starts and ends with a letter, CAP only right before a letter,
    // a single separator only between a letter and a letter or CAP
    const type = (x) => (x === undefined ? null : x.ch === CAP ? "C" : isSep(x.ch) ? "S" : "L");
    let out = "";
    let up = false;
    for (let i = 0; i < sym.length; i++) {
      const t = type(sym[i]);
      const prev = type(sym[i - 1]);
      const next = type(sym[i + 1]);
      if ((i === 0 && t !== "L") || (t === "C" && next !== "L") || (t === "S" && (prev !== "L" || next === null))) {
        return fail("sequence", sym[i].from, sym[i].to);
      }
      if (t === "C") {
        up = true;
        continue;
      }
      out += up ? sym[i].ch.toUpperCase() : sym[i].ch;
      up = false;
    }
    return { text: isUpper(run[0]) ? out.charAt(0).toUpperCase() + out.slice(1) : out };
  }

  function v2Encode(text, { key, clusters, rhythm }) {
    const counter = { k: 0 }; // the key runs on across the whole text, both languages
    return text.replace(rhythm ? PHRASES : WORDS, (seg, ...groups) => {
      const T = tables(langOf(groups.slice(0, 2)), !!clusters, !!rhythm);
      return v2EncSeg(seg, T, shiftsMod(key, T.ons.length), counter, rhythm);
    });
  }

  function v2Decode(text, { key, clusters, rhythm }) {
    const counter = { k: 0 };
    return decodeWords(text, rhythm ? PHRASES : WORDS, (run, L) => {
      const T = tables(L, !!clusters, !!rhythm);
      return v2DecRun(run, T, shiftsMod(key, T.ons.length), counter);
    });
  }

  // ---------- shared ----------

  // Decodes every match of `re` (one capture group per language) with decWord(match, lang)
  // and stops at the first error. Returns { text } or
  // { error: { code, index, length, wordIndex, wordLength } }, indices pointing into `text`.
  function decodeWords(text, re, decWord) {
    let error = null;
    const out = text.replace(re, (w, g1, g2, offset) => {
      if (error) return w;
      const r = decWord(w, langOf([g1, g2]));
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

  // ---------- public API ----------
  // opts: { version: 1 | 2, key: parseKey() result, clusters, rhythm } (flags are v2 only)

  function encode(text, opts = {}) {
    return opts.version === 2 ? v2Encode(text, opts) : v1Encode(text, opts);
  }

  function decode(text, opts = {}) {
    return opts.version === 2 ? v2Decode(text, opts) : v1Decode(text, opts);
  }

  const api = { encode, decode, parseKey };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Bubu = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
