#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Bubu cipher: turns Russian text into pronounceable gibberish syllables.

Modes:
  plain     - letter pairs -> syllables
  -s N      - plus Caesar shift of consonants by N
  -k WORD   - plus Vigenere shift of consonants by key word
"""
import argparse
import re
import sys
from math import isqrt

ABC = "оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё"  # Russian letters sorted by frequency
END = len(ABC)                               # padding marker for odd-length words
C, V = "пткбдгмнлрсзшхвф", "аоуиеыяю"        # 16 consonants, 8 vowels
RU = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"     # for turning a key word into shifts
WORD = re.compile(r"[а-яё]+", re.I)


# ---------- syllable layer ----------

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


# ---------- shift layer (Caesar / Vigenere on consonants) ----------

def _shifts(key):
    # int -> Caesar (one shift), str -> Vigenere (shift per key letter, а=0, б=1, ...)
    if isinstance(key, int):
        return [key]
    return [RU.index(ch) for ch in key.lower()]


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


# ---------- public API ----------

def encode(text, key=0):
    return _shift(WORD.sub(_enc_word, text), key, +1)


def decode(text, key=0):
    return WORD.sub(_dec_word, _shift(text, key, -1))


# ---------- CLI ----------

def _key_word(s):
    if not s or any(ch not in RU for ch in s.lower()):
        raise argparse.ArgumentTypeError("key must contain only Russian letters")
    return s


def main():
    p = argparse.ArgumentParser(
        description="Bubu cipher: Russian text <-> pronounceable gibberish.",
        epilog='examples:\n'
               '  uv run bubu_cipher.py enc "Привет, мир"\n'
               '  uv run bubu_cipher.py enc -s 3 "Привет, мир"\n'
               '  uv run bubu_cipher.py dec -k фраза "Гнареша, ..."\n'
               '  echo "текст" | uv run bubu_cipher.py enc -k фраза',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("mode", choices=["enc", "dec"], help="enc = encode, dec = decode")
    g = p.add_mutually_exclusive_group()
    g.add_argument("-s", "--shift", type=int, help="Caesar shift for consonants")
    g.add_argument("-k", "--key", type=_key_word, help="Vigenere key word, e.g. фраза")
    p.add_argument("text", nargs="*", help="text to process (reads stdin if omitted)")
    a = p.parse_intermixed_args()  # allows options between mode and text

    text = " ".join(a.text) if a.text else sys.stdin.read().rstrip("\n")
    key = a.key if a.key is not None else (a.shift or 0)
    print((encode if a.mode == "enc" else decode)(text, key))


if __name__ == "__main__":
    main()
