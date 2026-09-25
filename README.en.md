# Bubu — a joke cipher

[![Русский](https://img.shields.io/badge/README-Русский-blue)](README.md)

Turns Russian and English text into pronounceable gibberish and back. Inspired by the “PITIPIWPIW WIW WIW” meme.

**Site:** https://ars-mond.github.io/Bubu/

```
Привет, мир!   →  Вукапюбю, дюлу!       (version 2)
Hello, world!  →  Puwalipu, tabannupe!  (version 2)
Привет, мир!   →  Пмареда, фенху!       (version 1)
Hello, world!  →  Lepkimgu, ttepbymmu!  (version 1)
```

The site runs entirely in the browser: the text never leaves the page.

## Features

- **Russian and English** — the language is detected per word: Cyrillic becomes Russian syllables, Latin becomes English ones. Both languages can be mixed in one text.
- **Two cipher versions** — version 2 “cute” (the default) and version 1 “classic”.
- **Version 2 switches** — “Clusters” and “Rhythm”, latching buttons that appear when version 2 is selected.
- **Live conversion** — the result updates as you type.
- **Optional key** — a number is a shift, a word of Russian or English letters is a Vigenère key.
- **Strict decryption** — if the text could not have come out of the cipher, the site says exactly where:
  ```
  Could not decrypt.
  Character 3, word “Паш”: the letter “ш” is not used by the cipher.
  ```
- **Russian and English UI** — picked from the browser language, with a switch in the corner.
- **Compatibility** — the output matches the `bubu_cipher.py` script exactly.

## Version 2 — cute

Soft syllables with tails: `пан`, `мяу`, `pan`, `piu`.

1. A syllable is an onset consonant + a vowel + an optional tail.
2. The text is cut into triples of symbols, and each triple becomes two syllables. Common triples get the shortest syllables. A remainder of one or two symbols takes one or two syllables.
3. Capital letters are preserved: the first one by the case of the result, the others by an invisible marker inside the cipher.
4. **Clusters** add easy syllable onsets.
5. **Rhythm** encodes spaces and hyphens together with the words and splits the result into chunks of 2–3 syllables, like a song: `Woba-bipau, bipom-mayna`.
6. The key rotates the onset of every syllable.

|              | Russian               | English               |
| ------------ | --------------------- | --------------------- |
| Onsets       | `п м б т л н д к р в` | `p m b t l n d k r w` |
| + clusters   | `пр бр тр кл пл`      | `pr br tr bl pl`      |
| Vowels       | `а и у о я ю`         | `a i u o e`           |
| Tails        | `у н м й`             | `u n m y`             |

```
Hello, world   →  Puwalipu, tabannupe
+ clusters     →  Marilama, biblilemo
+ rhythm       →  Woba-bipau, bipom-mayna
+ both         →  Womi-mupra, plote-brera
```

## Version 1 — classic

1. Letters are numbered by frequency: `о = 0, е = 1, а = 2, …` for Russian and `e = 0, t = 1, a = 2, …` for English.
2. A word is split into letter pairs. If the word has an odd number of letters, the last one is paired with an end-of-word marker.
3. A pair `(a, b)` becomes a number using “square shells”: `m = max(a, b)`, `n = m² + (b if a = m, else m + 1 + a)`. Pairs of common letters get small numbers.
4. A small number becomes a “consonant + vowel” syllable, a larger one becomes “two consonants + vowel”.
5. The key rotates syllable consonants around a circle of 16. A key word advances to its next letter on every consonant of the ciphertext.

|                          | Russian                             | English                      |
| ------------------------ | ----------------------------------- | ---------------------------- |
| Frequency alphabet       | `оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё` | `etaoinshrdlcumwfgypbvkjxqz` |
| Syllable consonants (16) | `пткбдгмнлрсзшхвф`                  | `ptkbdgmnlrszfvhw`           |
| Syllable vowels          | `аоуиеыяю`                          | `aeiouy`                     |

Only the case of a word's first letter survives: `HELLO` decrypts back to `Hello`.

In both versions punctuation, digits and other characters stay as they are. Decrypting needs the same version, switches and key that were used to encrypt.

## Python script

[`exmaple/bubu_cipher.py`](exmaple/bubu_cipher.py) is the command-line version; it only needs [uv](https://docs.astral.sh/uv/).

```bash
uv run exmaple/bubu_cipher.py v2 enc "Привет, мир"                 # Вукапюбю, дюлу
uv run exmaple/bubu_cipher.py v2 enc "Hello, world"                # Puwalipu, tabannupe
uv run exmaple/bubu_cipher.py v2 enc -l -r "Hello, world"          # Womi-mupra, plote-brera
uv run exmaple/bubu_cipher.py v1 enc -k phrase "Hello, world"      # Nenbimnu, gpendymlu
uv run exmaple/bubu_cipher.py v2 dec -k phrase "Nudamipu, madanpuke"  # Hello, world
echo "text" | uv run exmaple/bubu_cipher.py ver2 enc -r            # louli-ma
```

- `v1` / `v2` — version (also `ver1`, `ver2`);
- `enc` / `dec` — encrypt or decrypt;
- `-l` — clusters (v2 only);
- `-r` — rhythm (v2 only);
- `-s N` — shift;
- `-k WORD` — Vigenère key of Russian or English letters.

The script validates ciphertext less strictly than the site: on some errors it returns wrong text instead of a message.

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
