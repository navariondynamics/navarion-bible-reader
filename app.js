const $ = (id) => document.getElementById(id);

const languageSelect = $("languageSelect");
const translationSelect = $("translationSelect");
const bookSelect = $("bookSelect");
const chapterSelect = $("chapterSelect");
const verseSelect = $("verseSelect");
const voiceSelect = $("voiceSelect");
const versesEl = $("verses");
const chapterTitle = $("chapterTitle");
const rateSelect = $("rateSelect");

let bible = null;
let voices = [];
let isPlaying = false;
let paused = false;
let playbackToken = 0;

let currentLanguage =
  localStorage.getItem("bibleLanguage") || "en";

let cursor = {
  bookIndex: 0,
  chapterIndex: 0,
  verseIndex: 0
};

const BIBLES = {
  en: {
    file: "./data/web.json",
    languageCode: "en-US",
    name: "World English Bible",
    abbreviation: "WEB"
  },

  es: {
    file: "./data/rv1909.json",
    languageCode: "es-MX",
    name: "Reina-Valera 1909",
    abbreviation: "RV1909"
  }
};

const UI = {
  en: {
    title: "Bible Reader created by Navarion Dynamics",
    install: "Install",
    language: "Language",
    translation: "Translation",
    book: "Book",
    chapter: "Chapter",
    verse: "Start verse",
    voice: "Voice",
    previous: "◀ Previous",
    next: "Next ▶",
    play: "▶ Play from here",
    pause: "⏸ Pause",
    resume: "▶ Resume",
    stop: "■ Stop",
    speed: "Speed",
    resumePlace: "Resume saved place",
    installNote:
      "<strong>iPhone install:</strong> Open this site in Safari → Share → Add to Home Screen → Open as Web App.",
    chapterWord: "chapter",
    verseWord: "verse"
  },

  es: {
    title: "Lector de la Biblia creado por Navarion Dynamics",
    install: "Instalar",
    language: "Idioma",
    translation: "Traducción",
    book: "Libro",
    chapter: "Capítulo",
    verse: "Versículo inicial",
    voice: "Voz",
    previous: "◀ Anterior",
    next: "Siguiente ▶",
    play: "▶ Reproducir desde aquí",
    pause: "⏸ Pausa",
    resume: "▶ Continuar",
    stop: "■ Detener",
    speed: "Velocidad",
    resumePlace: "Continuar desde posición guardada",
    installNote:
      "<strong>Instalar en iPhone:</strong> Abre esta página en Safari → Compartir → Añadir a pantalla de inicio → Abrir como app web.",
    chapterWord: "capítulo",
    verseWord: "versículo"
  }
};

function setLabelText(labelId, value) {
  const label = $(labelId);

  if (!label) {
    return;
  }

  for (const node of label.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      node.nodeValue = `\n        ${value}\n        `;
      return;
    }
  }
}

function applyInterfaceLanguage() {
  const text = UI[currentLanguage];

  $("appTitle").textContent = text.title;
  $("installHelp").textContent = text.install;

  setLabelText("languageLabel", text.language);
  setLabelText("translationSelectLabel", text.translation);
  setLabelText("bookLabel", text.book);
  setLabelText("chapterLabel", text.chapter);
  setLabelText("verseLabel", text.verse);
  setLabelText("voiceLabel", text.voice);
  setLabelText("speedLabel", text.speed);

  $("prevBtn").textContent = text.previous;
  $("nextBtn").textContent = text.next;
  $("playBtn").textContent = text.play;
  $("pauseBtn").textContent = text.pause;
  $("stopBtn").textContent = text.stop;
  $("resumeBtn").textContent = text.resumePlace;

  $("installNote").innerHTML = text.installNote;
}

function updateTranslationSelector() {
  const config = BIBLES[currentLanguage];

  translationSelect.innerHTML = "";

  const option = document.createElement("option");

  option.value = config.abbreviation;
  option.textContent = config.name;

  translationSelect.appendChild(option);
}

async function loadBible() {
  stopPlayback();

  const config = BIBLES[currentLanguage];

  try {
    const response = await fetch(
      `${config.file}?v=6`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Could not load ${config.file}: ${response.status}`
      );
    }

    bible = await response.json();

    if (
      !bible ||
      !Array.isArray(bible.books) ||
      bible.books.length === 0
    ) {
      throw new Error(
        "Bible data loaded, but no books were found."
      );
    }

    $("translationLabel").textContent = "";

    populateBooks();

    restorePosition(false);

    renderChapter();

    loadVoices();
  }

  catch (error) {
    console.error(error);

    translationSelect.innerHTML = "";
    bookSelect.innerHTML = "";
    chapterSelect.innerHTML = "";
    verseSelect.innerHTML = "";
    voiceSelect.innerHTML = "";

    versesEl.innerHTML =
      "<p>Could not load Bible data. Open the browser console for details.</p>";
  }
}

function populateBooks() {
  bookSelect.innerHTML = "";

  bible.books.forEach(
    (book, index) => {
      const option =
        document.createElement("option");

      option.value = index;
      option.textContent = book.name;

      bookSelect.appendChild(option);
    }
  );

  bookSelect.value = "0";

  populateChapters();
}

function populateChapters() {
  const bookIndex =
    Number(bookSelect.value) || 0;

  const book =
    bible.books[bookIndex];

  if (!book) {
    return;
  }

  chapterSelect.innerHTML = "";

  book.chapters.forEach(
    (chapter, index) => {
      const option =
        document.createElement("option");

      option.value = index;
      option.textContent = chapter.chapter;

      chapterSelect.appendChild(option);
    }
  );

  chapterSelect.value = "0";

  populateVerses();
}

function populateVerses() {
  const bookIndex =
    Number(bookSelect.value) || 0;

  const chapterIndex =
    Number(chapterSelect.value) || 0;

  const book =
    bible.books[bookIndex];

  if (!book) {
    return;
  }

  const chapter =
    book.chapters[chapterIndex];

  if (!chapter) {
    return;
  }

  verseSelect.innerHTML = "";

  chapter.verses.forEach(
    (verse, index) => {
      const option =
        document.createElement("option");

      option.value = index;
      option.textContent = verse.verse;

      verseSelect.appendChild(option);
    }
  );

  verseSelect.value = "0";
}

function renderChapter() {
  if (!bible) {
    return;
  }

  const bookIndex =
    Number(bookSelect.value) || 0;

  const chapterIndex =
    Number(chapterSelect.value) || 0;

  const verseIndex =
    Number(verseSelect.value) || 0;

  const book =
    bible.books[bookIndex];

  if (!book) {
    return;
  }

  const chapter =
    book.chapters[chapterIndex];

  if (!chapter) {
    return;
  }

  chapterTitle.textContent =
    `${book.name} ${chapter.chapter}`;

  versesEl.innerHTML = "";

  chapter.verses.forEach(
    (verse, index) => {
      const div =
        document.createElement("div");

      div.className = "verse";

      div.dataset.verseIndex =
        index;

      div.innerHTML =
        `<span class="n">${escapeHtml(verse.verse)}</span>` +
        escapeHtml(verse.text);

      div.addEventListener(
        "click",
        () => {
          verseSelect.value =
            String(index);

          cursor = {
            bookIndex,
            chapterIndex,
            verseIndex: index
          };

          savePosition();

          highlightCurrent();
        }
      );

      versesEl.appendChild(div);
    }
  );

  cursor = {
    bookIndex,
    chapterIndex,
    verseIndex
  };

  highlightCurrent(false);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function highlightCurrent(scroll = true) {
  document
    .querySelectorAll(".verse")
    .forEach(
      (verse) =>
        verse.classList.remove("playing")
    );

  const current =
    document.querySelector(
      `.verse[data-verse-index="${cursor.verseIndex}"]`
    );

  if (current) {
    current.classList.add("playing");

    if (scroll) {
      current.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }
}

function currentVerse() {
  return bible
    .books[cursor.bookIndex]
    .chapters[cursor.chapterIndex]
    .verses[cursor.verseIndex];
}

function positionKey() {
  return (
    "biblePosition_" +
    currentLanguage
  );
}

function savePosition() {
  if (!bible) {
    return;
  }

  localStorage.setItem(
    positionKey(),
    JSON.stringify(cursor)
  );
}

function restorePosition(render = true) {
  try {
    const saved =
      JSON.parse(
        localStorage.getItem(
          positionKey()
        ) || "null"
      );

    if (!saved || !bible) {
      return;
    }

    const book =
      bible.books[
        saved.bookIndex
      ];

    if (!book) {
      return;
    }

    const chapter =
      book.chapters[
        saved.chapterIndex
      ];

    if (!chapter) {
      return;
    }

    const verse =
      chapter.verses[
        saved.verseIndex
      ];

    if (!verse) {
      return;
    }

    cursor = {
      bookIndex:
        saved.bookIndex,

      chapterIndex:
        saved.chapterIndex,

      verseIndex:
        saved.verseIndex
    };

    bookSelect.value =
      String(
        cursor.bookIndex
      );

    populateChapters();

    chapterSelect.value =
      String(
        cursor.chapterIndex
      );

    populateVerses();

    verseSelect.value =
      String(
        cursor.verseIndex
      );

    if (render) {
      renderChapter();
    }
  }

  catch (error) {
    console.error(error);
  }
}

function moveCursorForward() {
  const book =
    bible.books[
      cursor.bookIndex
    ];

  const chapter =
    book.chapters[
      cursor.chapterIndex
    ];

  if (
    cursor.verseIndex + 1 <
    chapter.verses.length
  ) {
    cursor.verseIndex++;

    verseSelect.value =
      String(
        cursor.verseIndex
      );

    return true;
  }

  if (
    cursor.chapterIndex + 1 <
    book.chapters.length
  ) {
    cursor.chapterIndex++;

    cursor.verseIndex = 0;

    syncSelectors();

    return true;
  }

  if (
    cursor.bookIndex + 1 <
    bible.books.length
  ) {
    cursor.bookIndex++;

    cursor.chapterIndex = 0;
    cursor.verseIndex = 0;

    syncSelectors();

    return true;
  }

  return false;
}

function syncSelectors() {
  bookSelect.value =
    String(
      cursor.bookIndex
    );

  populateChapters();

  chapterSelect.value =
    String(
      cursor.chapterIndex
    );

  populateVerses();

  verseSelect.value =
    String(
      cursor.verseIndex
    );

  renderChapter();
}

function buildSpokenText() {
  const verse =
    currentVerse();

  const text =
    UI[currentLanguage];

  return (
    `${text.verseWord} ${verse.verse}. ` +
    verse.text
  );
}

function speakCurrent(
  token = playbackToken
) {
  if (
    !isPlaying ||
    paused ||
    token !== playbackToken ||
    !bible
  ) {
    return;
  }

  savePosition();

  highlightCurrent();

  const utterance =
    new SpeechSynthesisUtterance(
      buildSpokenText()
    );

  const selectedRate =
    Number(
      rateSelect.value
    );

  utterance.rate =
    Number.isFinite(
      selectedRate
    ) &&
    selectedRate > 0
      ? selectedRate
      : 1;

  utterance.lang =
    BIBLES[
      currentLanguage
    ].languageCode;

  const chosen =
    voices[
      Number(
        voiceSelect.value
      )
    ];

  if (chosen) {
    utterance.voice =
      chosen;

    utterance.lang =
      chosen.lang;
  }

  utterance.onend =
    () => {
      if (
        token !== playbackToken ||
        !isPlaying ||
        paused
      ) {
        return;
      }

      if (
        moveCursorForward()
      ) {
        savePosition();

        setTimeout(
          () =>
            speakCurrent(
              token
            ),
          60
        );
      }

      else {
        isPlaying = false;
      }
    };

  utterance.onerror =
    (event) => {
      if (
        token !== playbackToken ||
        !isPlaying ||
        paused
      ) {
        return;
      }

      if (
        event.error === "canceled" ||
        event.error === "interrupted"
      ) {
        return;
      }

      console.warn(
        "Speech error:",
        event.error
      );

      if (
        moveCursorForward()
      ) {
        setTimeout(
          () =>
            speakCurrent(
              token
            ),
          250
        );
      }
    };

  speechSynthesis.speak(
    utterance
  );
}

function startPlayback() {
  playbackToken++;

  speechSynthesis.cancel();

  cursor = {
    bookIndex:
      Number(
        bookSelect.value
      ) || 0,

    chapterIndex:
      Number(
        chapterSelect.value
      ) || 0,

    verseIndex:
      Number(
        verseSelect.value
      ) || 0
  };

  isPlaying = true;

  paused = false;

  $("pauseBtn").textContent =
    UI[currentLanguage].pause;

  const token =
    playbackToken;

  setTimeout(
    () =>
      speakCurrent(
        token
      ),
    50
  );
}

function pausePlayback() {
  if (!isPlaying) {
    return;
  }

  if (
    speechSynthesis.paused
  ) {
    speechSynthesis.resume();

    paused = false;

    $("pauseBtn").textContent =
      UI[currentLanguage].pause;
  }

  else {
    speechSynthesis.pause();

    paused = true;

    $("pauseBtn").textContent =
      UI[currentLanguage].resume;
  }
}

function stopPlayback() {
  playbackToken++;

  isPlaying = false;

  paused = false;

  speechSynthesis.cancel();

  $("pauseBtn").textContent =
    UI[currentLanguage].pause;

  if (bible) {
    savePosition();
  }
}

function loadVoices() {
  const allVoices =
    speechSynthesis.getVoices();

  const prefix =
    currentLanguage === "es"
      ? "es"
      : "en";

  voices =
    allVoices.filter(
      (voice) =>
        voice.lang
          .toLowerCase()
          .startsWith(
            prefix
          )
    );

  if (!voices.length) {
    voices =
      allVoices;
  }

  voiceSelect.innerHTML = "";

  voices.forEach(
    (voice, index) => {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        index;

      option.textContent =
        `${voice.name} — ${voice.lang}`;

      voiceSelect.appendChild(
        option
      );
    }
  );
}

function changeChapter(
  direction
) {
  let bookIndex =
    Number(
      bookSelect.value
    ) || 0;

  let chapterIndex =
    Number(
      chapterSelect.value
    ) || 0;

  if (direction > 0) {
    if (
      chapterIndex + 1 <
      bible.books[
        bookIndex
      ].chapters.length
    ) {
      chapterIndex++;
    }

    else if (
      bookIndex + 1 <
      bible.books.length
    ) {
      bookIndex++;

      chapterIndex = 0;
    }
  }

  else {
    if (
      chapterIndex > 0
    ) {
      chapterIndex--;
    }

    else if (
      bookIndex > 0
    ) {
      bookIndex--;

      chapterIndex =
        bible.books[
          bookIndex
        ].chapters.length - 1;
    }
  }

  bookSelect.value =
    String(
      bookIndex
    );

  populateChapters();

  chapterSelect.value =
    String(
      chapterIndex
    );

  populateVerses();

  verseSelect.value =
    "0";

  renderChapter();

  savePosition();
}

async function changeLanguage() {
  stopPlayback();

  currentLanguage =
    languageSelect.value;

  localStorage.setItem(
    "bibleLanguage",
    currentLanguage
  );

  document.documentElement.lang =
    currentLanguage;

  applyInterfaceLanguage();

  updateTranslationSelector();

  await loadBible();
}

bookSelect.addEventListener(
  "change",
  () => {
    populateChapters();

    renderChapter();

    savePosition();
  }
);

chapterSelect.addEventListener(
  "change",
  () => {
    populateVerses();

    renderChapter();

    savePosition();
  }
);

verseSelect.addEventListener(
  "change",
  () => {
    renderChapter();

    savePosition();
  }
);

languageSelect.addEventListener(
  "change",
  changeLanguage
);

$("playBtn").addEventListener(
  "click",
  startPlayback
);

$("pauseBtn").addEventListener(
  "click",
  pausePlayback
);

$("stopBtn").addEventListener(
  "click",
  stopPlayback
);

$("prevBtn").addEventListener(
  "click",
  () =>
    changeChapter(-1)
);

$("nextBtn").addEventListener(
  "click",
  () =>
    changeChapter(1)
);

$("resumeBtn").addEventListener(
  "click",
  () =>
    restorePosition(true)
);

rateSelect.addEventListener(
  "change",
  () => {
    localStorage.setItem(
      "biblePlaybackSpeed",
      rateSelect.value
    );

    if (isPlaying) {
      playbackToken++;

      speechSynthesis.cancel();

      paused = false;

      const token =
        playbackToken;

      setTimeout(
        () =>
          speakCurrent(
            token
          ),
        100
      );
    }
  }
);

$("installHelp").addEventListener(
  "click",
  () => {
    if (
      currentLanguage === "es"
    ) {
      alert(
        "En iPhone: abre la página en Safari → Compartir → Añadir a pantalla de inicio → Abrir como app web."
      );
    }

    else {
      alert(
        "On iPhone: open in Safari → Share → Add to Home Screen → Open as Web App."
      );
    }
  }
);

speechSynthesis.onvoiceschanged =
  loadVoices;

async function initialize() {
  languageSelect.value =
    currentLanguage;

  document.documentElement.lang =
    currentLanguage;

  const savedSpeed =
    localStorage.getItem(
      "biblePlaybackSpeed"
    );

  const validSpeeds = [
    "0.75",
    "1",
    "1.25",
    "1.5",
    "1.75",
    "2"
  ];

  rateSelect.value =
    validSpeeds.includes(
      savedSpeed
    )
      ? savedSpeed
      : "1";

  applyInterfaceLanguage();

  updateTranslationSelector();

  await loadBible();
}

initialize();

if (
  "serviceWorker"
  in navigator
) {
  navigator
    .serviceWorker
    .register(
      "./sw.js"
    )
    .catch(
      console.error
    );
}