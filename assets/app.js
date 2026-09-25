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
      keyInvalid: "The key must be a number (shift) or a word made of Russian or English letters.",
      version: "Version",
      v1Title: "Version 1 — classic: letter pairs → syllables.",
      v2Title: "Version 2 — cute: soft syllables with tails.",
      clusters: "Clusters",
      clustersTitle: "Add easy clusters: пр, бр, тр, кл, пл / pr, br, tr, bl, pl",
      rhythm: "Rhythm",
      rhythmTitle: "Chunks of 2–3 syllables, like a song",
      hint1: "classic · letter pairs → syllables",
      hint2: "cute · пан, мяу / pan, piu",
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
      how1: "Version 1 (classic): a word is split into letter pairs, each pair gets a number, and the number becomes a “consonant + vowel” or “two consonants + vowel” syllable. Common pairs get short syllables. English words turn into Latin syllables.",
      how2: "Version 2 (cute): soft syllables with tails — пан, бум, пиу, мяу. Every three symbols become two syllables, common triples the shortest ones. Capital letters are preserved. English words get their own syllables: pan, piu.",
      how3: "“Clusters” adds easy clusters: пр, бр, тр, кл, пл and pr, br, tr, bl, pl. “Rhythm” encodes spaces together with the words and splits the result into chunks of 2–3 syllables, like a song.",
      how4: "Optional key: a number is a shift, a word of Russian or English letters is a Vigenère key (а = 0, б = 1, …; a = 0, b = 1, …).",
      how5: "Decrypting needs the same version, switches and key. The result matches the bubu_cipher.py script exactly.",
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
        syllable: (f) => `“${f}” does not form a syllable.`,
        end: (f) => `a word cannot end with “${f}”.`,
        pair: (f) => `the syllables “${f}” mean nothing.`,
        single: (f) => `the syllable “${f}” means nothing.`,
        early: (f) => `the syllables “${f}” can only stand at the end of a word.`,
        sequence: (f) => `the syllables “${f}” do not add up to text.`,
      },
      checkKey: "Check the key.",
      checkSettings: "Check the version, switches and key.",
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
      keyInvalid: "Ключ должен быть числом (сдвиг) или словом из русских или английских букв.",
      version: "Версия",
      v1Title: "Версия 1 — классика: пары букв → слоги.",
      v2Title: "Версия 2 — милота: мягкие слоги с хвостиками.",
      clusters: "Сочетания",
      clustersTitle: "Добавить лёгкие сочетания: пр, бр, тр, кл, пл / pr, br, tr, bl, pl",
      rhythm: "Ритм",
      rhythmTitle: "Куски по 2–3 слога, как в песне",
      hint1: "классика · пары букв → слоги",
      hint2: "милота · пан, мяу / pan, piu",
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
      how1: "Версия 1 (классика): слово делится на пары букв, каждая пара получает номер, а номер становится слогом «согласная + гласная» или «две согласные + гласная». Частые пары — короткие слоги. Английские слова превращаются в латинские слоги.",
      how2: "Версия 2 (милота): мягкие слоги с хвостиками — пан, бум, пиу, мяу. Каждые три символа становятся двумя слогами, частые тройки — самыми короткими. Заглавные буквы сохраняются. У английских слов свои слоги: pan, piu.",
      how3: "«Сочетания» добавляют лёгкие сочетания: пр, бр, тр, кл, пл и pr, br, tr, bl, pl. «Ритм» шифрует пробелы вместе со словами и разбивает результат на куски по 2–3 слога, как песню.",
      how4: "Необязательный ключ: число — это сдвиг, слово из русских или английских букв — ключ Виженера (а = 0, б = 1, …; a = 0, b = 1, …).",
      how5: "Для расшифровки нужны те же версия, переключатели и ключ. Результат полностью совпадает со скриптом bubu_cipher.py.",
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
        syllable: (f) => `«${f}» не складывается в слог.`,
        end: (f) => `слово не может заканчиваться на «${f}».`,
        pair: (f) => `слоги «${f}» ничего не означают.`,
        single: (f) => `слог «${f}» ничего не означает.`,
        early: (f) => `слоги «${f}» могут стоять только в конце слова.`,
        sequence: (f) => `слоги «${f}» не складываются в текст.`,
      },
      checkKey: "Проверьте ключ.",
      checkSettings: "Проверьте версию, переключатели и ключ.",
    },
  };

  const $ = (id) => document.getElementById(id);
  const input = $("input");
  const output = $("output");
  const keyInput = $("key");
  const keyReadout = $("keyReadout");
  const modeGroup = $("mode");
  const versionGroup = $("version");
  const flagButtons = { clusters: $("clusters"), rhythm: $("rhythm") };
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
  let version = store.get("version") === "1" ? 1 : 2;
  const flags = { clusters: store.get("clusters") === "1", rhythm: store.get("rhythm") === "1" };
  let hasResult = false;
  let turns = 0;
  let copyTimer = 0;

  const t = () => STRINGS[lang];
  const settings = (key) => ({ version, key: key || undefined, clusters: flags.clusters, rhythm: flags.rhythm });

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
    // Hint at the settings when the syllables are fine but mean nothing with them.
    if (["pair", "single", "early", "sequence"].includes(err.code)) msg += " " + s.checkSettings;
    else if (key.kind !== "none" && (err.code === "range" || err.code === "marker")) msg += " " + s.checkKey;
    return msg;
  }

  function convert(src, key) {
    if (mode === "enc") return { text: Bubu.encode(src, settings(key)) };
    const r = Bubu.decode(src, settings(key));
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

    // Placeholders double as a live example of the current settings.
    const sampleCipher = Bubu.encode(s.sample, settings(key));
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

  // ---------- switches ----------

  function setSeg(group, value) {
    const buttons = [...group.querySelectorAll("button[data-value]")];
    buttons.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === value)));
    group.dataset.index = String(buttons.findIndex((b) => b.dataset.value === value));
  }

  // Click picks an option; arrow keys move to the other one.
  function bindSeg(group, onPick) {
    const buttons = [...group.querySelectorAll("button[data-value]")];
    group.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-value]");
      if (b) onPick(b.dataset.value);
    });
    group.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      const next = buttons.find((b) => b.getAttribute("aria-checked") !== "true");
      onPick(next.dataset.value);
      next.focus();
    });
  }

  function setMode(next) {
    mode = next;
    setSeg(modeGroup, mode);
    const s = t();
    $("inTitle").textContent = mode === "enc" ? s.plainTitle : s.cipherTitle;
    $("outTitle").textContent = mode === "enc" ? s.cipherTitle : s.plainTitle;
    store.set("mode", mode);
    update();
  }

  function renderOptions() {
    setSeg(versionGroup, String(version));
    $("flags").hidden = version !== 2;
    for (const [name, b] of Object.entries(flagButtons)) b.setAttribute("aria-pressed", String(flags[name]));
    $("versionHint").textContent = version === 2 ? t().hint2 : t().hint1;
  }

  function setVersion(next) {
    version = next;
    store.set("version", String(version));
    renderOptions();
    update();
  }

  function toggleFlag(name) {
    flags[name] = !flags[name];
    store.set(name, flags[name] ? "1" : "0");
    renderOptions();
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
    renderOptions();
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

  bindSeg(modeGroup, (value) => {
    if (value !== mode) setMode(value);
  });

  bindSeg(versionGroup, (value) => {
    if (Number(value) !== version) setVersion(Number(value));
  });

  for (const [name, b] of Object.entries(flagButtons)) b.addEventListener("click", () => toggleFlag(name));

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
