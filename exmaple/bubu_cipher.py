#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Bubu cipher: turns Russian and English text into pronounceable gibberish.

Languages are detected per word: Cyrillic -> Russian, Latin -> English.

Versions (first argument):
  v1  - classic: letter pairs -> CV / CCV syllables
  v2  - cute: soft sounds + tails (пан, мяу / pan, piu)
        -l  plus easy clusters (пра, бру / pra, blu)
        -r  plus rhythm: chunks of 2-3 syllables, like a song
Shifts (both versions):
  -s N               - Caesar shift of consonants by N
  -k WORD            - Vigenere shift of consonants by key word (Russian or English)
"""
import argparse
import re
import sys
from functools import lru_cache
from itertools import cycle, product
from math import isqrt, prod
from types import SimpleNamespace

RU = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"
EN = "abcdefghijklmnopqrstuvwxyz"
CAP = "^"                                    # internal marker: next letter is uppercase

LANGS = {
    "ru": SimpleNamespace(
        letters=RU,
        # v1: letters by frequency, 16 consonants, 8 vowels
        abc="оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё", cons="пткбдгмнлрсзшхвф", vows="аоуиеыяю",
        # v2: soft onsets (cutest first), onsets with clusters (-l), vowels, tails
        ons1=tuple("пмбтлндкрв"),
        ons2=("п", "пр", "м", "б", "бр", "т", "тр", "л", "кл", "н", "д", "пл", "к", "р", "в"),
        vow="аиуояю", tail=("", "у", "н", "м", "й"), bad={("у", "у"), ("ю", "у")},
        freq=dict(zip(" оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё-" + CAP, (
            200, 110, 85, 80, 74, 67, 63, 55, 47, 45, 44, 35, 32, 30, 28, 26, 20, 19,
            17, 17, 16, 16, 14, 12, 10, 9, 7, 6, 5, 4, 3, 3, 1, 1, 2, 3), strict=True)),
    ),
    "en": SimpleNamespace(
        letters=EN,
        abc="etaoinshrdlcumwfgypbvkjxqz", cons="ptkbdgmnlrszfvhw", vows="aeiouy",
        ons1=tuple("pmbtlndkrw"),
        ons2=("p", "pr", "m", "b", "br", "t", "tr", "l", "bl", "n", "d", "pl", "k", "r", "w"),
        vow="aiuoe", tail=("", "u", "n", "m", "y"), bad={("u", "u")},
        freq=dict(zip(" etaoinshrdlcumwfgypbvkjxqz-" + CAP, (
            200, 127, 91, 82, 75, 70, 67, 63, 61, 60, 43, 40, 28, 28, 24, 24, 22, 20,
            20, 19, 15, 10, 8, 2, 2, 1, 1, 2, 3), strict=True)),
    ),
}
LANG_IDS = list(LANGS)


def _alt(charsets, rhythm):
    # one capturing group per language; rhythm mode also joins words by single " " or "-"
    tpl = "({c}+(?:[ -]{c}+)*)" if rhythm else "({c}+)"
    return re.compile("|".join(tpl.format(c=f"[{s}{s.upper()}]") for s in charsets))


def _lang(m):
    return LANG_IDS[m.lastindex - 1]


def _shifts(key):
    # int -> Caesar (one shift), str -> Vigenere (shift per key letter, а/a=0, б/b=1, ...)
    if isinstance(key, int):
        return [key]
    return [RU.index(ch) if ch in RU else EN.index(ch) for ch in key.lower()]


# =====================================================================
#  V1: CLASSIC
# =====================================================================

WORDS = _alt([L.letters for L in LANGS.values()], False)


def pair_to_n(a, b):
    # "square shells": pairs of frequent letters get small numbers -> short syllables
    m = max(a, b)
    return m * m + (b if a == m else m + 1 + a)


def n_to_pair(n):
    m = isqrt(n)
    r = n - m * m
    return (m, r) if r <= m else (r - m - 1, m)


def _c_syl(L, n):
    # small n -> CV (2 chars), the rest -> CCV (3 chars)
    nc, nv = len(L.cons), len(L.vows)
    if n < nc * nv:
        return L.cons[n // nv] + L.vows[n % nv]
    n -= nc * nv
    return L.cons[n // (nc * nv)] + L.cons[n // nv % nc] + L.vows[n % nv]


def _c_unsyl(L, s):
    nc, nv = len(L.cons), len(L.vows)
    if len(s) == 2:
        return L.cons.index(s[0]) * nv + L.vows.index(s[1])
    return nc * nv + (L.cons.index(s[0]) * nc + L.cons.index(s[1])) * nv + L.vows.index(s[2])


def _c_enc(w, L):
    idx = [L.abc.index(ch) for ch in w.lower()] + [len(L.abc)]   # + END marker
    out = "".join(_c_syl(L, pair_to_n(idx[i], idx[i + 1])) for i in range(0, len(idx) - 1, 2))
    return out.capitalize() if w[0].isupper() else out


def _c_dec(w, L):
    found = re.findall(f"[{L.cons}]{{1,2}}[{L.vows}]", w.lower())
    if "".join(found) != w.lower():
        raise ValueError(f"not a v1 cipher text: {w!r}")
    out = ""
    for s in found:
        a, b = n_to_pair(_c_unsyl(L, s))
        out += L.abc[a] + (L.abc[b] if b < len(L.abc) else "")
    return out.capitalize() if w[0].isupper() else out


def _c_shift(text, key, sign):
    ks, out = cycle(_shifts(key)), []
    for ch in text:
        lo = ch.lower()
        for L in LANGS.values():
            if len(lo) == 1 and lo in L.cons:
                lo = L.cons[(L.cons.index(lo) + sign * next(ks)) % len(L.cons)]
                ch = lo.upper() if ch.isupper() else lo
                break
        out.append(ch)
    return "".join(out)


# =====================================================================
#  V2: CUTE
#  Syllable = onset + vowel + optional tail. Parsing is unambiguous:
#  every syllable starts with a consonant, so a consonant before a vowel
#  opens a new syllable, anything else is a tail of the previous one.
#  Text is packed as 3 symbols -> 2 syllables (frequent triples get the
#  shortest syllables); a 1-2 symbol remainder uses 1 or 2 syllables.
# =====================================================================

RHYTHM = (2, 3, 1, 2, 2, 3)                  # syllables per chunk in -r mode


def _cute_letters(L):
    return "".join(sorted(set("".join(L.ons2) + L.vow + "".join(L.tail))))


@lru_cache(maxsize=None)
def _tables(lang, clusters, rhythm):
    L = LANGS[lang]
    ons = list(L.ons2 if clusters else L.ons1)
    # cost: a cluster counts as half an extra letter, so clusters show up often enough
    cost = lambda t: 0.5 + 0.5 * len(ons[t[0]]) + len(L.tail[t[2]])  # noqa: E731
    syls = sorted((t for t in product(range(len(ons)), range(len(L.vow)), range(len(L.tail)))
                   if (L.vow[t[1]], L.tail[t[2]]) not in L.bad),     # no "пуу", "piuu"
                  key=lambda t: (cost(t), sum(t)))
    text = [ons[o] + L.vow[v] + L.tail[t] for o, v, t in syls]
    # symbols: letters + CAP (+ space and hyphen in rhythm mode, where words are merged)
    alpha = [ch for ch in L.freq if rhythm or ch not in " -"]
    total = sum(L.freq[ch] for ch in alpha)
    q = 0.05 if rhythm else 0.2              # rough weight of a 2-symbol remainder
    units = sorted((u for n in (2, 3) for u in product(alpha, repeat=n)),
                   key=lambda u: -prod(L.freq[ch] / total for ch in u) * (q if len(u) == 2 else 1))
    costs = [cost(t) for t in syls]
    pairs = sorted(product(range(len(syls)), repeat=2),
                   key=lambda ab: (costs[ab[0]] + costs[ab[1]], ab[0] + ab[1]))
    enc = dict(zip(units, pairs))
    onset_re = "|".join(sorted(ons, key=len, reverse=True))
    vt = "".join(t for t in L.tail if t and t in L.vow)       # vowel tails: always a tail
    ct = "".join(t for t in L.tail if t and t not in L.vow)   # consonant tails: not before a vowel
    return SimpleNamespace(
        ons=ons, vow=L.vow, tail=L.tail, syls=syls, text=text,
        idx={t: i for i, t in enumerate(syls)},
        enc=enc, dec={v: k for k, v in enc.items()},
        singles=sorted(alpha, key=lambda ch: -L.freq[ch]),
        syl_re=re.compile(f"({onset_re})([{L.vow}])([{vt}]|[{ct}](?![{L.vow}]))?"),
    )


def _rhythm(parts):
    out, i, k = "", 0, 0
    while i < len(parts):
        n = RHYTHM[k % len(RHYTHM)]
        if out:
            out += "-" if k % 3 == 1 else " "
        out += "".join(parts[i:i + n])
        i, k = i + n, k + 1
    return out


def _cute_enc(seg, T, ks, rhythm):
    # first capital is shown by output case, the others are coded with CAP
    sym = []
    for i, ch in enumerate(seg):
        if i and ch.isupper():
            sym.append(CAP)
        sym.append(ch.lower())
    ids = []
    for i in range(0, len(sym), 3):
        g = tuple(sym[i:i + 3])
        ids += [T.singles.index(g[0])] if len(g) == 1 else T.enc[g]
    parts = []
    for i in ids:
        o, v, t = T.syls[i]
        parts.append(T.text[T.idx[((o + next(ks)) % len(T.ons), v, t)]])
    out = _rhythm(parts) if rhythm else "".join(parts)
    return out.capitalize() if seg[0].isupper() else out


def _cute_dec(run, T, ks):
    s = re.sub("[ -]", "", run.lower())
    found = T.syl_re.findall(s)
    if "".join(map("".join, found)) != s:
        raise ValueError(f"not a v2 cipher text: {run!r}")
    ids = [T.idx[((T.ons.index(o) - next(ks)) % len(T.ons), T.vow.index(v), T.tail.index(t))]
           for o, v, t in found]
    sym = []
    for i in range(0, len(ids), 2):
        sym += T.dec[tuple(ids[i:i + 2])] if i + 1 < len(ids) else [T.singles[ids[i]]]
    out, up = [], False
    for ch in sym:
        if ch == CAP:
            up = True
            continue
        out.append(ch.upper() if up else ch)
        up = False
    out = "".join(out)
    return out[:1].upper() + out[1:] if run[0].isupper() else out


# =====================================================================
#  PUBLIC API
# =====================================================================

def encode(text, key=0, cute=False, clusters=False, rhythm=False):
    if not cute:
        return _c_shift(WORDS.sub(lambda m: _c_enc(m.group(), LANGS[_lang(m)]), text), key, +1)
    ks = cycle(_shifts(key))
    segs = _alt([L.letters for L in LANGS.values()], rhythm)
    return segs.sub(lambda m: _cute_enc(m.group(), _tables(_lang(m), clusters, rhythm), ks, rhythm),
                    text)


def decode(text, key=0, cute=False, clusters=False, rhythm=False):
    if not cute:
        return WORDS.sub(lambda m: _c_dec(m.group(), LANGS[_lang(m)]), _c_shift(text, key, -1))
    ks = cycle(_shifts(key))
    runs = _alt([_cute_letters(L) for L in LANGS.values()], rhythm)
    return runs.sub(lambda m: _cute_dec(m.group(), _tables(_lang(m), clusters, rhythm), ks), text)


# =====================================================================
#  CLI
# =====================================================================

def _key_word(s):
    if not s or any(ch not in RU + EN for ch in s.lower()):
        raise argparse.ArgumentTypeError("key must contain only Russian or English letters")
    return s


def _version(s):
    # accepts v1 / V1 / ver1 / 1 (same for 2)
    m = re.fullmatch(r"(?:v|ver)?([12])", s.strip().lower())
    if not m:
        raise argparse.ArgumentTypeError("version must be v1 or v2 (also ver1, ver2)")
    return int(m.group(1))


def main():
    p = argparse.ArgumentParser(
        description="Bubu cipher: Russian / English text <-> pronounceable gibberish.",
        epilog='examples:\n'
               '  uv run bubu_cipher.py v1 enc "Привет, мир"\n'
               '  uv run bubu_cipher.py v1 enc -k phrase "Hello, world"\n'
               '  uv run bubu_cipher.py v2 enc "Привет, John! How are you?"\n'
               '  uv run bubu_cipher.py v2 enc -l -r -k фраза "Привет, мир"\n'
               '  uv run bubu_cipher.py v2 dec -l -r -k фраза "..."\n'
               '  echo "text" | uv run bubu_cipher.py ver2 enc -r\n'
               'decode with the same version, flags and key as encode',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("version", type=_version, metavar="{v1,v2}",
                   help="v1 = classic, v2 = cute (also ver1, ver2)")
    p.add_argument("mode", choices=["enc", "dec"], help="enc = encode, dec = decode")
    p.add_argument("-l", "--clusters", action="store_true",
                   help="v2 only: add easy clusters (пр бр тр кл пл / pr br tr bl pl)")
    p.add_argument("-r", "--rhythm", action="store_true",
                   help="v2 only: song-like chunks of 2-3 syllables")
    g = p.add_mutually_exclusive_group()
    g.add_argument("-s", "--shift", type=int, help="Caesar shift for consonants")
    g.add_argument("-k", "--key", type=_key_word, help="Vigenere key word, e.g. фраза or phrase")
    p.add_argument("text", nargs="*", help="text to process (reads stdin if omitted)")
    a = p.parse_intermixed_args()  # allows options between mode and text

    if a.version == 1 and (a.clusters or a.rhythm):
        p.error("-l and -r work only with v2")
    text = " ".join(a.text) if a.text else sys.stdin.read().rstrip("\n")
    key = a.key if a.key is not None else (a.shift or 0)
    opts = dict(cute=a.version == 2, clusters=a.clusters, rhythm=a.rhythm)
    try:
        print((encode if a.mode == "enc" else decode)(text, key, **opts))
    except (KeyError, ValueError, IndexError) as e:
        p.error(f"cannot decode, check version, flags and key ({e})")


if __name__ == "__main__":
    main()
