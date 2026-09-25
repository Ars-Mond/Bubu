(function () {
  "use strict";

  const STRINGS = {
    en: {
      title: "Bubu cipher",
      logo: "BUBU",
      kicker: "joke cipher for Russian and English",
      tagline: "Turns Russian and English text into pronounceable gibberish and back. Inspired by the “PITIPIWPIW WIW WIW” meme.",
      sample: "Hello, world!",
      modeLabel: "Mode",
      encrypt: "Encrypt",
      decrypt: "Decrypt",
      key: "Key",
      keyPlaceholder: "number or word",
      keyNone: "no key",
      keyCaesar: (k) => `caesar ${k}`,
      keyVigenere: (n) => `vigenère · ${n}`,
      keyBad: "invalid",
      keyInvalid: "The key must be a number (Caesar shift) or a word made of Russian or English letters.",
      plainTitle: "Text",
      cipherTitle: "Cipher",
      clear: "Clear",
      copy: "Copy",
      copied: "Copied",
      live: "auto",
      swap: "Swap input and result",
      inputLabel: "Input",
      outputLabel: "Result",
      count: (n) => `${n} chars`,
      privacy: "Everything runs in your browser. The text never leaves this page.",
      howTitle: "How it works",
      how1: "Each word is split into letter pairs. Letters are ranked by frequency, so pairs of common letters get small numbers.",
      how2: "Every number becomes a syllable: consonant + vowel, or two consonants + vowel for larger numbers.",
      how3: "Each word keeps its script: Russian words turn into Cyrillic syllables, English words into Latin ones. Each language has its own letter frequencies.",
      how4: "The optional key shifts consonants: a number is a Caesar shift, a word is a Vigenère key (a = 0, b = 1, …; а = 0, б = 1, …).",
      how5: "Output is fully compatible with the bubu_cipher.py script.",
      failed: "Could not decrypt.",
      whereChar: (c) => `Character ${c}`,
      whereLine: (l, c) => `Line ${l}, character ${c}`,
      inWord: (w) => `word “${w}”`,
      reasons: {
        letter: (f) => `the letter “${f}” is not used by the cipher.`,
        vowel: (f) => `the vowel “${f}” has no consonant before it.`,
        cluster: (f) => `too many consonants in a row: “${f}”.`,
        tail: (f) => `the word ends with “${f}”, but every syllable must end with a vowel.`,
        range: (f) => `the syllable “${f}” does not match any pair of letters.`,
        marker: (f) => `the syllable “${f}” can only stand at the end of a word.`,
      },
      checkKey: "Check the key.",
    },
    ru: {
      title: "Бубу — шуточный шифр",
      logo: "БУБУ",
      kicker: "шуточный шифр для русского и английского",
      tagline: "Превращает русский и английский текст в произносимую абракадабру и обратно. Придумано по мотивам мема «PITIPIWPIW WIW WIW».",
      sample: "Привет, мир!",
      modeLabel: "Режим",
      encrypt: "Зашифровать",
      decrypt: "Расшифровать",
      key: "Ключ",
      keyPlaceholder: "число или слово",
      keyNone: "без ключа",
      keyCaesar: (k) => `цезарь ${k}`,
      keyVigenere: (n) => `виженер · ${n}`,
      keyBad: "ошибка",
      keyInvalid: "Ключ должен быть числом (сдвиг Цезаря) или словом из русских или английских букв.",
      plainTitle: "Текст",
      cipherTitle: "Шифр",
      clear: "Очистить",
      copy: "Копировать",
      copied: "Скопировано",
      live: "авто",
      swap: "Поменять местами",
      inputLabel: "Исходный текст",
      outputLabel: "Результат",
      count: (n) => `символов: ${n}`,
      privacy: "Всё считается прямо в браузере — текст никуда не отправляется.",
      howTitle: "Как это работает",
      how1: "Слово делится на пары букв. Буквы упорядочены по частоте, поэтому пары частых букв получают маленькие номера.",
      how2: "Каждый номер превращается в слог: согласная + гласная, а для больших номеров — две согласные + гласная.",
      how3: "Каждое слово остаётся в своём алфавите: русские слова превращаются в кириллические слоги, английские — в латинские. У каждого языка своя таблица частот.",
      how4: "Необязательный ключ сдвигает согласные: число — это сдвиг Цезаря, слово — ключ Виженера (а = 0, б = 1, …; a = 0, b = 1, …).",
      how5: "Результат полностью совместим со скриптом bubu_cipher.py.",
      failed: "Не удалось расшифровать.",
      whereChar: (c) => `Символ ${c}`,
      whereLine: (l, c) => `Строка ${l}, символ ${c}`,
      inWord: (w) => `слово «${w}»`,
      reasons: {
        letter: (f) => `буква «${f}» не используется в шифре.`,
        vowel: (f) => `перед гласной «${f}» не хватает согласной.`,
        cluster: (f) => `слишком много согласных подряд: «${f}».`,
        tail: (f) => `слово обрывается на «${f}», а каждый слог должен заканчиваться гласной.`,
        range: (f) => `слог «${f}» не соответствует ни одной паре букв.`,
        marker: (f) => `слог «${f}» может стоять только в конце слова.`,
      },
      checkKey: "Проверьте ключ.",
    },
  };

  const $ = (id) => document.getElementById(id);
  const input = $("input");
  const output = $("output");
  const keyInput = $("key");
  const keyReadout = $("keyReadout");
  const modeGroup = document.querySelector(".mode");
  const copyBtn = $("copy");
  const swapBtn = $("swap");

  const store = {
    get(name) {
      try { return localStorage.getItem("bubu." + name); } catch (e) { return null; }
    },
    set(name, value) {
      try { localStorage.setItem("bubu." + name, value); } catch (e) { /* storage unavailable */ }
    },
  };

  let lang = document.documentElement.lang === "ru" ? "ru" : "en";
  let mode = store.get("mode") === "dec" ? "dec" : "enc";
  let hasResult = false;
  let turns = 0;
  let copyTimer = 0;

  const t = () => STRINGS[lang];

  // ---------- conversion ----------

  function describeError(err, src, key) {
    const s = t();
    const before = src.slice(0, err.index);
    const lineStart = before.lastIndexOf("\n") + 1;
    const line = before.split("\n").length;
    const col = [...before.slice(lineStart)].length + 1;
    const where = src.includes("\n") ? s.whereLine(line, col) : s.whereChar(col);

    let word = src.substr(err.wordIndex, err.wordLength);
    if (word.length > 32) word = word.slice(0, 30) + "…";
    const fragment = src.substr(err.index, err.length);

    let msg = `${s.failed}\n${where}, ${s.inWord(word)}: ${s.reasons[err.code](fragment)}`;
    if (key.kind !== "none" && (err.code === "range" || err.code === "marker")) msg += " " + s.checkKey;
    return msg;
  }

  function convert(src, key) {
    if (mode === "enc") return { text: Bubu.encode(src, key.shifts) };
    const r = Bubu.decode(src, key.shifts);
    return r.error ? { message: describeError(r.error, src, key) } : { text: r.text };
  }

  function renderKey(key) {
    const s = t();
    keyReadout.dataset.kind = key ? key.kind : "bad";
    if (!key) keyReadout.textContent = s.keyBad;
    else if (key.kind === "none") keyReadout.textContent = s.keyNone;
    else if (key.kind === "caesar") keyReadout.textContent = s.keyCaesar(key.label);
    else keyReadout.textContent = s.keyVigenere([...key.label].length);
  }

  function update() {
    const s = t();
    const src = input.value;
    const key = Bubu.parseKey(keyInput.value);
    renderKey(key);

    // Placeholders double as a live example of the current mode and key.
    const shifts = key ? key.shifts : [0];
    const sampleCipher = Bubu.encode(s.sample, shifts);
    input.placeholder = mode === "enc" ? s.sample : sampleCipher;
    output.placeholder = mode === "enc" ? sampleCipher : s.sample;

    hasResult = false;
    if (!src) {
      output.value = "";
    } else if (!key) {
      output.value = s.keyInvalid;
    } else {
      const r = convert(src, key);
      output.value = r.text !== undefined ? r.text : r.message;
      hasResult = r.text !== undefined;
    }

    $("inCount").textContent = s.count([...src].length);
    $("outCount").textContent = s.count(hasResult ? [...output.value].length : 0);
    copyBtn.disabled = !hasResult;

    store.set("text", src);
    store.set("key", keyInput.value);
  }

  // ---------- mode, language ----------

  function setMode(next) {
    mode = next;
    modeGroup.dataset.mode = mode;
    modeGroup.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-checked", String(b.dataset.mode === mode));
    });
    const s = t();
    $("inTitle").textContent = mode === "enc" ? s.plainTitle : s.cipherTitle;
    $("outTitle").textContent = mode === "enc" ? s.cipherTitle : s.plainTitle;
    store.set("mode", mode);
    update();
  }

  function setLang(next) {
    lang = next;
    const s = t();
    document.documentElement.lang = lang;
    document.title = s.title;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = s[el.dataset.i18n];
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", s[el.dataset.i18nAria]);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.title = s[el.dataset.i18nTitle];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = s[el.dataset.i18nPlaceholder];
    });
    document.querySelectorAll("[data-lang]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
    $("logo").textContent = s.logo;
    store.set("lang", lang);
    setMode(mode);
  }

  // ---------- title scramble ----------

  function scrambleLogo() {
    const el = $("logo");
    const target = el.textContent;
    const glyphs = lang === "ru" ? "ПТКБДГМНЛРСЗШХВФАОУИЕЫЯЮ" : "BDGKLMNPRSTVZAEIOUY";
    const settleAt = [...target].map((_, i) => 6 + i * 4);
    let frame = 0;
    const tick = () => {
      frame++;
      el.textContent = [...target]
        .map((ch, i) => (frame >= settleAt[i] ? ch : glyphs[Math.floor(Math.random() * glyphs.length)]))
        .join("");
      if (frame < settleAt[settleAt.length - 1]) setTimeout(tick, 45);
    };
    tick();
  }

  // ---------- actions ----------

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    output.select();
    document.execCommand("copy");
    return Promise.resolve();
  }

  modeGroup.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-mode]");
    if (b && b.dataset.mode !== mode) setMode(b.dataset.mode);
  });

  modeGroup.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      setMode(mode === "enc" ? "dec" : "enc");
      modeGroup.querySelector(`[data-mode="${mode}"]`).focus();
    }
  });

  document.querySelectorAll("[data-lang]").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.lang !== lang) setLang(b.dataset.lang);
    });
  });

  input.addEventListener("input", update);
  keyInput.addEventListener("input", update);

  $("clear").addEventListener("click", () => {
    input.value = "";
    update();
    input.focus();
  });

  copyBtn.addEventListener("click", () => {
    if (!hasResult) return;
    copyText(output.value).then(() => {
      copyBtn.textContent = t().copied;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copyBtn.textContent = t().copy), 1400);
    });
  });

  // Flips the direction; a successful result becomes the new input.
  swapBtn.addEventListener("click", () => {
    turns++;
    swapBtn.style.setProperty("--turn", turns * 180 + "deg");
    if (hasResult) input.value = output.value;
    setMode(mode === "enc" ? "dec" : "enc");
  });

  // ---------- boot ----------

  input.value = store.get("text") || "";
  keyInput.value = store.get("key") || "";
  setLang(lang);
  document.documentElement.classList.remove("booting");
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) scrambleLogo();
})();
