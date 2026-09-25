/* Bubu cipher: browser port of exmaple/bubu_cipher.py.
 *
 * v1 (classic): letter pairs -> CV / CCV syllables. Every word keeps its script:
 *   Russian words become Cyrillic syllables, English words become Latin ones.
 * v2 (cute): soft syllables with tails (пан, бум, пиу, мяу), Russian only,
 *   with optional easy clusters and song-like rhythm.
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

  // ---------- key ----------

  const KEY_RU = indexMap("абвгдеёжзийклмнопрстуфхцчшщъыьэюя");
  const KEY_EN = indexMap("abcdefghijklmnopqrstuvwxyz");

  // "" -> no key, integer -> Caesar, word -> Vigenere (а/a = 0, б/b = 1, ...).
  // v1 takes Russian and English letters, v2 only Russian ones. Returns null when invalid.
  function parseKey(raw, version = 1) {
    const s = String(raw).trim();
    if (s === "") return { kind: "none", values: [0n] };
    if (/^[+-]?\d+$/.test(s)) return { kind: "caesar", values: [BigInt(s)], label: s };
    const values = [...s.toLowerCase()].map((ch) =>
      KEY_RU.has(ch) ? KEY_RU.get(ch) : version === 1 ? KEY_EN.get(ch) : undefined);
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

  function lang(abc, cons, vows) {
    return {
      abc,               // letters sorted by frequency
      end: abc.length,   // padding marker for odd-length words
      cons,              // 16 consonants
      vows,              // vowels
      abcIndex: indexMap(abc),
      consIndex: indexMap(cons),
      vowsIndex: indexMap(vows),
    };
  }

  const RU = lang("оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё", "пткбдгмнлрсзшхвф", "аоуиеыяю");
  const EN = lang("etaoinshrdlcumwfgypbvkjxqz", "ptkbdgmnlrszwhvf", "aouiey"); // Latin counterparts
  const WORD = /([А-Яа-яЁё]+)|[A-Za-z]+/g; // group 1 is set for Russian words

  // Consonant in either case -> { lang, index }, for the shift layer.
  const CONS = new Map();
  for (const l of [RU, EN]) {
    [...l.cons].forEach((c, i) => {
      CONS.set(c, { lang: l, index: i });
      CONS.set(c.toUpperCase(), { lang: l, index: i });
    });
  }

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

  function v1EncWord(w, l) {
    const idx = [...w.toLowerCase()].map((ch) => l.abcIndex.get(ch));
    idx.push(l.end);
    let out = "";
    for (let i = 0; i + 1 < idx.length; i += 2) out += syl(pairToN(idx[i], idx[i + 1]), l);
    return isUpper(w[0]) ? capitalize(out) : out;
  }

  // Returns { text } or { error: { code, at, length } } with `at` relative to the word.
  function v1DecWord(w, l) {
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

  // Caesar / Vigenere on consonants over the whole text.
  function v1Shift(text, shifts, sign) {
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

  function v1Encode(text, { key }) {
    return v1Shift(text.replace(WORD, (w, ru) => v1EncWord(w, ru ? RU : EN)), shiftsMod(key, 16), +1);
  }

  function v1Decode(text, { key }) {
    const plain = v1Shift(text, shiftsMod(key, 16), -1);
    return decodeWords(plain, WORD, (w, ru) => v1DecWord(w, ru ? RU : EN));
  }

  // =====================================================================
  //  v2: cute
  //  Syllable = onset + vowel + optional tail. Every syllable starts with a
  //  consonant, so parsing is unambiguous. Text is packed as 3 symbols ->
  //  2 syllables (frequent triples get the shortest syllables); a 1-2 symbol
  //  remainder uses 1 or 2 syllables.
  // =====================================================================

  const CAP = "^"; // internal marker: next letter is uppercase
  const ONS1 = ["п", "м", "б", "т", "л", "н", "д", "к", "р", "в"]; // soft single onsets, cutest first
  const ONS2 = ["п", "пр", "м", "б", "бр", "т", "тр", "л", "кл", "н", "д", "пл", "к", "р", "в"];
  const VOW = "аиуояю";
  const TAIL = ["", "у", "н", "м", "й"]; // optional syllable tails
  const FREQ_SYMBOLS = [..." оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё-" + CAP];
  const FREQ = new Map(FREQ_SYMBOLS.map((ch, i) => [ch, [
    200, 110, 85, 80, 74, 67, 63, 55, 47, 45, 44, 35, 32, 30, 28, 26, 20, 19,
    17, 17, 16, 16, 14, 12, 10, 9, 7, 6, 5, 4, 3, 3, 1, 1, 2, 3][i]]));
  const CUTE = new Set(ONS1.join("") + VOW + TAIL.join("")); // all letters of cute output
  const RHYTHM = [2, 3, 1, 2, 2, 3]; // syllables per chunk in rhythm mode
  const SEG_W = /[А-Яа-яЁё]+/g; // segment = one word
  const SEG_R = /[А-Яа-яЁё]+(?:[ -][А-Яа-яЁё]+)*/g; // segment = words with spaces
  const isSep = (ch) => ch === " " || ch === "-";

  const sylKey = (o, v, t) => (o * VOW.length + v) * TAIL.length + t;
  const tableCache = new Map();

  function tables(clusters, rhythm) {
    const id = (clusters ? 2 : 0) + (rhythm ? 1 : 0);
    if (tableCache.has(id)) return tableCache.get(id);

    const ons = clusters ? ONS2 : ONS1;
    // cost: a cluster counts as half an extra letter, so clusters show up often enough
    const cost = ([o, , t]) => 0.5 + 0.5 * ons[o].length + TAIL[t].length;

    const combos = [];
    for (let o = 0; o < ons.length; o++) {
      for (let v = 0; v < VOW.length; v++) {
        for (let t = 0; t < TAIL.length; t++) {
          if (!("ую".includes(VOW[v]) && TAIL[t] === "у")) combos.push([o, v, t]); // no "пуу", "мюу"
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
    const alpha = FREQ_SYMBOLS.filter((ch) => rhythm || !isSep(ch));
    const total = alpha.reduce((sum, ch) => sum + FREQ.get(ch), 0);
    const p = alpha.map((ch) => FREQ.get(ch) / total);
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
      .sort((x, y) => FREQ.get(y.ch) - FREQ.get(x.ch) || x.i - y.i)
      .map((d) => d.ch);

    const T = {
      ons,
      onsIndex: new Map(ons.map((o, i) => [o, i])),
      onsLongestFirst: ons.map((o, i) => ({ o, i })).sort((x, y) => y.o.length - x.o.length || x.i - y.i).map((d) => d.o),
      syls,
      text: syls.map(([o, v, t]) => ons[o] + VOW[v] + TAIL[t]),
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

  function v2Encode(text, { key, clusters, rhythm }) {
    const T = tables(!!clusters, !!rhythm);
    const S = T.syls.length;
    const n = T.ons.length;
    const ks = shiftsMod(key, n);
    let k = 0; // the key runs on across the whole text

    return text.replace(rhythm ? SEG_R : SEG_W, (seg) => {
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
        return T.text[T.idx.get(sylKey(mod(o + ks[k++ % ks.length], n), v, t))];
      });
      const out = rhythm ? rhythmJoin(parts) : parts.join("");
      return isUpper(seg[0]) ? capitalize(out) : out;
    });
  }

  // Mirrors the script's syllable regex at position p: onset (longest first) + vowel
  // + optional tail, where н/м/й only count as a tail when no vowel follows.
  function matchSyllable(s, p, T) {
    for (const on of T.onsLongestFirst) {
      const v = s[p + on.length];
      if (!s.startsWith(on, p) || v === undefined || !VOW.includes(v)) continue;
      const q = p + on.length + 1;
      const c = s[q];
      let tail = "";
      if (c === "у") tail = c;
      else if ((c === "н" || c === "м" || c === "й") && !(s[q + 1] && VOW.includes(s[q + 1]))) tail = c;
      return { o: T.onsIndex.get(on), v: VOW.indexOf(v), t: TAIL.indexOf(tail), from: p, to: q + tail.length };
    }
    return null;
  }

  function v2DecRun(run, T, ks, counter) {
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

    for (let j = 0; j < s.length; j++) if (!CUTE.has(s[j])) return fail("letter", j);

    const found = [];
    for (let p = 0; p < s.length;) {
      const m = matchSyllable(s, p, T);
      if (!m) {
        if (VOW.includes(s[p])) return fail("vowel", p);
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
      const id = T.idx.get(sylKey(mod(m.o - ks[counter.k++ % ks.length], n), m.v, m.t));
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

  function v2Decode(text, { key, clusters, rhythm }) {
    const T = tables(!!clusters, !!rhythm);
    const ks = shiftsMod(key, T.ons.length);
    const counter = { k: 0 };
    return decodeWords(text, rhythm ? SEG_R : SEG_W, (run) => v2DecRun(run, T, ks, counter));
  }

  // ---------- shared ----------

  // Decodes every match of `re` with decWord(match, ...groups) and stops at the first error.
  // Returns { text } or { error: { code, index, length, wordIndex, wordLength } },
  // with indices pointing into `text`.
  function decodeWords(text, re, decWord) {
    let error = null;
    const out = text.replace(re, (...args) => {
      const w = args[0];
      const offset = args[args.length - 2];
      if (error) return w;
      const r = decWord(...args.slice(0, -2));
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
