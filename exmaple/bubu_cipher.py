#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Bubu cipher: turns Russian and English text into pronounceable gibberish syllables.

Every word keeps its script: Russian words become Cyrillic syllables,
English words become Latin ones.

Modes:
  plain     - letter pairs -> syllables
  -s N      - plus Caesar shift of consonants by N
  -k WORD   - plus Vigenere shift of consonants by key word
"""
import argparse
import re
import sys
from math import isqrt
from typing import NamedTuple


class Lang(NamedTuple):
    abc: str    # letters sorted by frequency; len(abc) is the padding marker for odd-length words
    cons: str   # 16 consonants
    vows: str   # vowels
    order: str  # alphabet order, for turning a key word into shifts


RU = Lang(
    abc="оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё",
    cons="пткбдгмнлрсзшхвф",
    vows="аоуиеыяю",
    order="абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
)
EN = Lang(
    abc="etaoinshrdlcumwfgypbvkjxqz",
    cons="ptkbdgmnlrszwhvf",  # Latin counterparts of the Russian consonants
    vows="aouiey",
    order="abcdefghijklmnopqrstuvwxyz",
)
WORD = re.compile(r"([А-Яа-яЁё]+)|[A-Za-z]+")  # group 1 is set for Russian words
# consonant in either case -> (language, index), for the shift layer
CONS = {ch: (lang, i) for lang in (RU, EN) for i, c in enumerate(lang.cons) for ch in (c, c.upper())}


# ---------- syllable layer ----------

def pair_to_n(a, b):
    # "square shells": pairs of frequent letters get small numbers -> short syllables
    m = max(a, b)
    return m * m + (b if a == m else m + 1 + a)


def n_to_pair(n):
    m = isqrt(n)
    r = n - m * m
    return (m, r) if r <= m else (r - m - 1, m)


def syl(n, lang):
    # below |C|*|V| -> CV (2 chars), above -> CCV (3 chars)
    c, v = lang.cons, lang.vows
    cv = len(c) * len(v)
    if n < cv:
        return c[n // len(v)] + v[n % len(v)]
    n -= cv
    return c[n // cv] + c[n // len(v) % len(c)] + v[n % len(v)]


def unsyl(s, lang):
    c, v = lang.cons, lang.vows
    n = c.index(s[-2]) * len(v) + v.index(s[-1])
    return n if len(s) == 2 else len(c) * len(v) * (1 + c.index(s[0])) + n


def _lang(m):
    return RU if m.group(1) else EN


def _enc_word(m):
    w, lang = m.group(), _lang(m)
    idx = [lang.abc.index(ch) for ch in w.lower()] + [len(lang.abc)]
    out = "".join(syl(pair_to_n(idx[i], idx[i + 1]), lang) for i in range(0, len(idx) - 1, 2))
    return out.capitalize() if w[0].isupper() else out


def _dec_word(m):
    w, lang = m.group(), _lang(m)
    out = ""
    for s in re.findall(f"[{lang.cons}]{{1,2}}[{lang.vows}]", w.lower()):
        a, b = n_to_pair(unsyl(s, lang))
        out += lang.abc[a] + (lang.abc[b] if b < len(lang.abc) else "")
    return out.capitalize() if w[0].isupper() else out


# ---------- shift layer (Caesar / Vigenere on consonants) ----------

def _shifts(key):
    # int -> Caesar (one shift), str -> Vigenere (shift per key letter, а/a=0, б/b=1, ...)
    if isinstance(key, int):
        return [key]
    return [(RU.order if ch in RU.order else EN.order).index(ch) for ch in key.lower()]


def _shift(text, key, sign):
    ks, i, out = _shifts(key), 0, []
    for ch in text:
        if ch in CONS:
            lang, j = CONS[ch]
            lo = lang.cons[(j + sign * ks[i % len(ks)]) % len(lang.cons)]
            ch = lo.upper() if ch.isupper() else lo
            i += 1
        out.append(ch)
    return "".join(out)


# ---------- public API ----------

def encode(text, key=0):
    return _shift(WORD.sub(_enc_word, text), key, +1)


def decode(text, key=0):
    return WORD.sub(_dec_word, _shift(text, key, -1))


# ---------- CLI ----------

def _key_word(s):
    if not s or any(ch not in RU.order + EN.order for ch in s.lower()):
        raise argparse.ArgumentTypeError("key must contain only Russian or English letters")
    return s


def main():
    p = argparse.ArgumentParser(
        description="Bubu cipher: Russian/English text <-> pronounceable gibberish.",
        epilog='examples:\n'
               '  uv run bubu_cipher.py enc "Привет, мир"\n'
               '  uv run bubu_cipher.py enc "Hello, world"\n'
               '  uv run bubu_cipher.py enc -s 3 "Привет, мир"\n'
               '  uv run bubu_cipher.py dec -k фраза "Гнареша, ..."\n'
               '  echo "текст" | uv run bubu_cipher.py enc -k secret',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("mode", choices=["enc", "dec"], help="enc = encode, dec = decode")
    g = p.add_mutually_exclusive_group()
    g.add_argument("-s", "--shift", type=int, help="Caesar shift for consonants")
    g.add_argument("-k", "--key", type=_key_word, help="Vigenere key word, e.g. фраза or secret")
    p.add_argument("text", nargs="*", help="text to process (reads stdin if omitted)")
    a = p.parse_intermixed_args()  # allows options between mode and text

    text = " ".join(a.text) if a.text else sys.stdin.read().rstrip("\n")
    key = a.key if a.key is not None else (a.shift or 0)
    print((encode if a.mode == "enc" else decode)(text, key))


if __name__ == "__main__":
    main()
