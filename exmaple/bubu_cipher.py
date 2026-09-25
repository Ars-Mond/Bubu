#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Bubu cipher: turns Russian text into pronounceable gibberish syllables.

Versions (first argument):
  v1  - classic: letter pairs -> CV / CCV syllables
  v2  - cute: soft sounds + tails (пан, бум, пиу, мяу)
        -l  plus easy clusters (пра, бру, тра, кла, пли)
        -r  plus rhythm: chunks of 2-3 syllables, like a song
Shifts (both versions):
  -s N               - Caesar shift of consonants by N
  -k WORD            - Vigenere shift of consonants by key word
"""
import argparse
import re
import sys
from functools import lru_cache
from itertools import cycle, product
from math import isqrt, prod
from types import SimpleNamespace

RU = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"     # for turning a key word into shifts
WORD = re.compile(r"[а-яё]+", re.I)


def _shifts(key):
    # int -> Caesar (one shift), str -> Vigenere (shift per key letter, а=0, б=1, ...)
    if isinstance(key, int):
        return [key]
    return [RU.index(ch) for ch in key.lower()]


# =====================================================================
#  CLASSIC VERSION
# =====================================================================

ABC = "оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё"  # Russian letters sorted by frequency
END = len(ABC)                               # padding marker for odd-length words
C, V = "пткбдгмнлрсзшхвф", "аоуиеыяю"        # 16 consonants, 8 vowels


def pair_to_n(a, b):
    # "square shells": pairs of frequent letters get small numbers -> short syllables
    m = max(a, b)
    return m * m + (b if a == m else m + 1 + a)


def n_to_pair(n):
    m = isqrt(n)
    r = n - m * m
    return (m, r) if r <= m else (r - m - 1, m)


def syl(n):
    # 0..127 -> CV (2 chars), 128.. -> CCV (3 chars)
    if n < 128:
        return C[n // 8] + V[n % 8]
    n -= 128
    return C[n // 128] + C[n // 8 % 16] + V[n % 8]


def unsyl(s):
    if len(s) == 2:
        return C.index(s[0]) * 8 + V.index(s[1])
    return 128 + C.index(s[0]) * 128 + C.index(s[1]) * 8 + V.index(s[2])


def _enc_word(m):
    w = m.group()
    idx = [ABC.index(ch) for ch in w.lower()] + [END]
    out = "".join(syl(pair_to_n(idx[i], idx[i + 1])) for i in range(0, len(idx) - 1, 2))
    return out.capitalize() if w[0].isupper() else out


def _dec_word(m):
    w = m.group()
    out = ""
    for s in re.findall(f"[{C}]{{1,2}}[{V}]", w.lower()):
        a, b = n_to_pair(unsyl(s))
        out += ABC[a] + (ABC[b] if b < END else "")
    return out.capitalize() if w[0].isupper() else out


def _shift(text, key, sign):
    ks, i, out = _shifts(key), 0, []
    for ch in text:
        lo = ch.lower()
        if lo in C:
            lo = C[(C.index(lo) + sign * ks[i % len(ks)]) % len(C)]
            ch = lo.upper() if ch.isupper() else lo
            i += 1
        out.append(ch)
    return "".join(out)


# =====================================================================
#  CUTE VERSION
#  Syllable = onset + vowel + optional tail. Parsing is unambiguous:
#  every syllable starts with a consonant, so a consonant before a vowel
#  opens a new syllable, anything else is a tail of the previous one.
#  Text is packed as 3 symbols -> 2 syllables (frequent triples get the
#  shortest syllables); a 1-2 symbol remainder uses 1 or 2 syllables.
# =====================================================================

CAP = "^"                                    # internal marker: next letter is uppercase
ONS1 = tuple("пмбтлндкрв")                   # soft single onsets, cutest first
ONS2 = ("п", "пр", "м", "б", "бр", "т", "тр", "л", "кл", "н", "д", "пл", "к", "р", "в")
                                             # -l: easy clusters mixed in, so they show up often
VOW = "аиуояю"
TAIL = ("", "у", "н", "м", "й")              # optional syllable tails
FREQ = dict(zip(" оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё-" + CAP, (
    200, 110, 85, 80, 74, 67, 63, 55, 47, 45, 44, 35, 32, 30, 28, 26, 20, 19,
    17, 17, 16, 16, 14, 12, 10, 9, 7, 6, 5, 4, 3, 3, 1, 1, 2, 3), strict=True))
CUTE = "".join(sorted(set("".join(ONS1) + VOW + "".join(TAIL))))   # all letters of cute output
RHYTHM = (2, 3, 1, 2, 2, 3)                  # syllables per chunk in -r mode
SEG_W = WORD                                             # segment = one word
SEG_R = re.compile(r"[а-яё]+(?:[ -][а-яё]+)*", re.I)     # segment = words with spaces
RUN_W = re.compile(f"[{CUTE}]+", re.I)
RUN_R = re.compile(f"[{CUTE}]+(?:[ -][{CUTE}]+)*", re.I)


@lru_cache(maxsize=None)
def _tables(clusters, rhythm):
    ons = list(ONS2 if clusters else ONS1)
    # cost: a cluster counts as half an extra letter, so clusters show up often enough
    cost = lambda t: 0.5 + 0.5 * len(ons[t[0]]) + len(TAIL[t[2]])    # noqa: E731
    syls = sorted((t for t in product(range(len(ons)), range(len(VOW)), range(len(TAIL)))
                   if not (VOW[t[1]] in "ую" and TAIL[t[2]] == "у")),   # no "пуу", "мюу"
                  key=lambda t: (cost(t), sum(t)))
    text = [ons[o] + VOW[v] + TAIL[t] for o, v, t in syls]
    # symbols: letters + CAP (+ space and hyphen in rhythm mode, where words are merged)
    alpha = [ch for ch in FREQ if rhythm or ch not in " -"]
    total = sum(FREQ[ch] for ch in alpha)
    q = 0.05 if rhythm else 0.2              # rough weight of a 2-symbol remainder
    units = sorted((u for n in (2, 3) for u in product(alpha, repeat=n)),
                   key=lambda u: -prod(FREQ[ch] / total for ch in u) * (q if len(u) == 2 else 1))
    costs = [cost(t) for t in syls]
    pairs = sorted(product(range(len(syls)), repeat=2),
                   key=lambda ab: (costs[ab[0]] + costs[ab[1]], ab[0] + ab[1]))
    enc = dict(zip(units, pairs))
    onset_re = "|".join(sorted(ons, key=len, reverse=True))
    return SimpleNamespace(
        ons=ons, syls=syls, text=text, idx={t: i for i, t in enumerate(syls)},
        enc=enc, dec={v: k for k, v in enc.items()},
        singles=sorted(alpha, key=lambda ch: -FREQ[ch]),
        syl_re=re.compile(f"({onset_re})([{VOW}])(у|[нмй](?![{VOW}]))?"),
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
        raise ValueError(f"not a cute cipher text: {run!r}")
    ids = [T.idx[((T.ons.index(o) - next(ks)) % len(T.ons), VOW.index(v), TAIL.index(t))]
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
        return _shift(WORD.sub(_enc_word, text), key, +1)
    T, ks = _tables(clusters, rhythm), cycle(_shifts(key))
    seg = SEG_R if rhythm else SEG_W
    return seg.sub(lambda m: _cute_enc(m.group(), T, ks, rhythm), text)


def decode(text, key=0, cute=False, clusters=False, rhythm=False):
    if not cute:
        return WORD.sub(_dec_word, _shift(text, key, -1))
    T, ks = _tables(clusters, rhythm), cycle(_shifts(key))
    run = RUN_R if rhythm else RUN_W
    return run.sub(lambda m: _cute_dec(m.group(), T, ks), text)


# =====================================================================
#  CLI
# =====================================================================

def _key_word(s):
    if not s or any(ch not in RU for ch in s.lower()):
        raise argparse.ArgumentTypeError("key must contain only Russian letters")
    return s


def _version(s):
    # accepts v1 / V1 / ver1 / 1 (same for 2)
    m = re.fullmatch(r"(?:v|ver)?([12])", s.strip().lower())
    if not m:
        raise argparse.ArgumentTypeError("version must be v1 or v2 (also ver1, ver2)")
    return int(m.group(1))


def main():
    p = argparse.ArgumentParser(
        description="Bubu cipher: Russian text <-> pronounceable gibberish.",
        epilog='examples:\n'
               '  uv run bubu_cipher.py v1 enc "Привет, мир"\n'
               '  uv run bubu_cipher.py v1 enc -k фраза "Привет, мир"\n'
               '  uv run bubu_cipher.py v2 enc "Привет, мир"\n'
               '  uv run bubu_cipher.py v2 enc -l -r -k фраза "Привет, мир"\n'
               '  uv run bubu_cipher.py v2 dec -l -r -k фраза "..."\n'
               '  echo "текст" | uv run bubu_cipher.py ver2 enc -r\n'
               'decode with the same version, flags and key as encode',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("version", type=_version, metavar="{v1,v2}",
                   help="v1 = classic, v2 = cute (also ver1, ver2)")
    p.add_argument("mode", choices=["enc", "dec"], help="enc = encode, dec = decode")
    p.add_argument("-l", "--clusters", action="store_true",
                   help="v2 only: add easy clusters пр бр тр кл пл")
    p.add_argument("-r", "--rhythm", action="store_true",
                   help="v2 only: song-like chunks of 2-3 syllables")
    g = p.add_mutually_exclusive_group()
    g.add_argument("-s", "--shift", type=int, help="Caesar shift for consonants")
    g.add_argument("-k", "--key", type=_key_word, help="Vigenere key word, e.g. фраза")
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
