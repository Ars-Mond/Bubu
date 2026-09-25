# Bubu — a joke cipher

[![Русский](https://img.shields.io/badge/README-Русский-blue)](README.md)

Turns Russian and English text into pronounceable gibberish and back. Inspired by the “PITIPIWPIW WIW WIW” meme.

```
Привет, мир!   →  Пмареда, фенху!
Hello, world!  →  Lopkumge, ttopbymme!
```

The site runs entirely in the browser: the text never leaves the page.

## Features

- **Live conversion** — the result updates as you type.
- **Russian and English** — every word keeps its script: Russian words become Cyrillic syllables, English words become Latin ones. Both languages can be mixed in one text.
- **Optional key** — a number is a Caesar shift, a word of Russian or English letters is a Vigenère key.
- **Strict decryption** — if the text could not have come out of the cipher, the site says exactly where:
  ```
  Could not decrypt.
  Character 3, word “Hello”: the syllable “llo” does not match any pair of letters.
  ```
- **Russian and English UI** — picked from the browser language, with a switch in the corner.
- **Compatibility** — the site and the `bubu_cipher.py` script produce identical output.

## How it works

1. Letters are numbered by frequency: `о = 0, е = 1, а = 2, …` for Russian and `e = 0, t = 1, a = 2, …` for English.
2. A word is split into letter pairs. If the word has an odd number of letters, the last one is paired with an end-of-word marker.
3. A pair `(a, b)` becomes a number using “square shells”: `m = max(a, b)`, `n = m² + (b if a = m, else m + 1 + a)`. Pairs of common letters get small numbers.
4. A small number becomes a “consonant + vowel” syllable, a larger one becomes “two consonants + vowel”.
5. The key rotates syllable consonants around a circle of 16. A key word advances to its next letter on every consonant of the ciphertext.

|                          | Russian                             | English                      |
| ------------------------ | ----------------------------------- | ---------------------------- |
| Frequency alphabet       | `оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё` | `etaoinshrdlcumwfgypbvkjxqz` |
| Syllable consonants (16) | `пткбдгмнлрсзшхвф`                  | `ptkbdgmnlrszwhvf`           |
| Syllable vowels          | `аоуиеыяю`                          | `aouiey`                     |

Punctuation, digits and other characters stay as they are. Only the case of a word's first letter survives: `HELLO` decrypts back to `Hello`.

## Python script

[`exmaple/bubu_cipher.py`](exmaple/bubu_cipher.py) is the command-line version; it only needs [uv](https://docs.astral.sh/uv/):

```bash
uv run exmaple/bubu_cipher.py enc "Привет, мир"             # Пмареда, фенху
uv run exmaple/bubu_cipher.py enc "Hello, world"            # Lopkumge, ttopbymme
uv run exmaple/bubu_cipher.py enc -s 3 "Привет, мир"        # Брашена, кеспу
uv run exmaple/bubu_cipher.py dec -k фраза "Гнареша, фешву" # Привет, мир
echo "text" | uv run exmaple/bubu_cipher.py enc -k secret
```

- `enc` / `dec` — encrypt or decrypt;
- `-s N` — Caesar shift;
- `-k WORD` — Vigenère key.

Unlike the site, the script does not validate ciphertext: it silently skips anything it cannot read.

## Running and publishing

There is no build step. Open `index.html` in a browser, or start a local server:

```bash
uv run --no-project python -m http.server 8000
```

The site is published to GitHub Pages by GitHub Actions ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)) on every push to `master`. Enable it once in the repository settings: **Settings → Pages → Source → GitHub Actions**.

## Project layout

```
index.html                   the site page
assets/cipher.js             the cipher: a port of bubu_cipher.py with strict decryption
assets/app.js                the UI
assets/style.css             styles
exmaple/bubu_cipher.py       the command-line script
.github/workflows/pages.yml  GitHub Pages auto-deploy
```

## License

[MIT](LICENSE)
