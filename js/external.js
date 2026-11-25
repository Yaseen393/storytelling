/* =========================================================
   Daredevil — main script
   ========================================================= */

/* ---------- Helpers ---------- */

// keep a number between min and max
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

// blend from a to b by t (0 → a, 1 → b)
const lerp = (a, b, t) => a + (b - a) * t;

// turn p into 0 → 1 progress between start and end
const range = (p, start, end) => clamp((p - start) / (end - start));

// slow start, fast end
const easeIn = (t) => t * t * t;

// fast start, slow end
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// slow start and slow end
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);


/* ---------- Language helpers (texts live in js/translations.js) ---------- */

let currentLanguage = "en";

// look up a piece of interface text in the current language
function t(key) {
  return TRANSLATIONS[currentLanguage][key] ?? TRANSLATIONS.en[key] ?? key;
}

// pick the right language from a { en: "…", ar: "…" } value (used by the stories array)
function localize(value) {
  return typeof value === "object" ? value[currentLanguage] ?? value.en : value;
}


/* ---------- Background music ---------- */

const music = document.querySelector(".music");
const musicButton = document.querySelector(".navbar__music");

const MUSIC_VOLUME = 0.5;
const MUSIC_FADE_MS = 800;
let fadeId = 0; // lets a new fade cancel one that's still running

// smoothly change the volume, then run onDone (if given)
function fadeMusic(toVolume, onDone) {
  const id = ++fadeId;
  const fromVolume = music.volume;
  const startTime = performance.now();

  function step(now) {
    if (id !== fadeId) return; // a newer fade took over

    const t = clamp((now - startTime) / MUSIC_FADE_MS);
    music.volume = lerp(fromVolume, toVolume, t);

    if (t < 1) requestAnimationFrame(step);
    else if (onDone) onDone();
  }

  requestAnimationFrame(step);
}

function setMusicButton(isPlaying) {
  musicButton.classList.toggle("is-playing", isPlaying);
  musicButton.setAttribute("aria-pressed", isPlaying);
  musicButton.setAttribute("aria-label", t(isPlaying ? "music.stop" : "music.play"));
}

async function startMusic() {
  if (music.paused) music.volume = 0;

  try {
    await music.play();
  } catch (error) {
    return; // the browser blocked playback, so leave the button off
  }

  setMusicButton(true);
  fadeMusic(MUSIC_VOLUME);
}

function stopMusic() {
  setMusicButton(false);
  fadeMusic(0, () => music.pause());
}

musicButton.addEventListener("click", () => {
  const isPlaying = musicButton.classList.contains("is-playing");
  isPlaying ? stopMusic() : startMusic();
});


/* ---------- Hero / intro scroll sequence ---------- */

const hero = document.querySelector(".hero");
const heroVideo = hero.querySelector(".hero__media");
const heroLines = hero.querySelectorAll(".hero__line");
const heroLinesBox = hero.querySelector(".hero__lines");

// where each step happens, as a share of the hero's total scroll (0 → 1)
const STEP_ZOOM = { start: 0, end: 0.18 };
const STEP_TEXT = { start: 0.2, end: 0.42 };
const STEP_TEXT_OUT = { start: 0.45, end: 0.5 };
const STEP_RADAR = { start: 0.49, end: 0.68 };
const STEP_LABEL_IN = { start: 0.62, end: 0.68 };
const STEP_DIVE = { start: 0.72, end: 1 };
const STEP_LABEL_OUT = { start: 0.78, end: 0.84 };
const STEP_FADE = { start: 0.9, end: 1 };

// Step 0: show the scroll hint once the intro video has finished
function showScrollHint() {
  hero.classList.add("is-ready");
}

heroVideo.addEventListener("ended", showScrollHint);
setTimeout(showScrollHint, 7000); // backup in case the video can't autoplay

// Step 2 setup: wrap every word in a <span> so each can animate on its own
function splitIntoWords(line) {
  const words = line.textContent.trim().split(/\s+/);
  line.textContent = "";

  return words.map((word, index) => {
    const span = document.createElement("span");
    span.className = "hero__word";
    span.textContent = word;
    line.append(span);
    if (index < words.length - 1) line.append(" ");
    return span;
  });
}

// "let" because the words are rebuilt when the language changes
let heroWords = [...heroLines].flatMap(splitIntoWords);

// how far we've scrolled through a tall sticky section, from 0 to 1
function getSectionProgress(section) {
  const scrollable = section.offsetHeight - window.innerHeight;
  return clamp(-section.getBoundingClientRect().top / scrollable);
}

// Step 1: push in, blur, darken and close the iris
function renderZoom(progress) {
  const t = easeInOut(range(progress, STEP_ZOOM.start, STEP_ZOOM.end));

  hero.style.setProperty("--zoom", lerp(1, 1.6, t));
  hero.style.setProperty("--blur", lerp(0, 4, t));
  hero.style.setProperty("--bright", lerp(1, 0.35, t));
  hero.style.setProperty("--iris", lerp(45, 0, t));
}

// Step 2: reveal the words one after another (each fades in over ~3 words)
function renderText(progress) {
  const t = range(progress, STEP_TEXT.start, STEP_TEXT.end);
  const overlap = 3;
  const total = heroWords.length + overlap;

  heroWords.forEach((word, index) => {
    const wordT = clamp((t * total - index) / overlap);

    word.style.opacity = wordT;
    word.style.filter = `blur(${(1 - wordT) * 10}px)`;
    word.style.transform = `translateY(${(1 - wordT) * 0.4}em)`;
  });
}

// Step 3a: the three lines blur away before the radar pulse
function renderTextOut(progress) {
  const t = range(progress, STEP_TEXT_OUT.start, STEP_TEXT_OUT.end);

  heroLinesBox.style.opacity = 1 - t;
  heroLinesBox.style.filter = `blur(${t * 8}px)`;
  heroLinesBox.style.transform = `scale(${1 + t * 0.1})`;
}

// Step 3b: radar ring grows from the center and reveals the city inside it
function renderRadar(progress) {
  const t = easeOut(range(progress, STEP_RADAR.start, STEP_RADAR.end));

  // big enough to reach the corners of the screen
  const maxRadius = Math.hypot(window.innerWidth, window.innerHeight) / 2;

  hero.style.setProperty("--radar-r", `${t * maxRadius * 1.05}px`);
  const ringsIn = range(progress, STEP_RADAR.start, STEP_RADAR.start + 0.02);
  const ringsOut = range(progress, 0.6, 0.68);
  hero.style.setProperty("--ring-opacity", ringsIn * (1 - ringsOut));

  // hide the intro video once the city covers the whole screen
  hero.style.setProperty("--video-opacity", 1 - range(progress, 0.6, 0.68));
}

// Step 4: location tag fades in, then the camera dives into the city and fades to black
function renderCity(progress) {
  const revealT = easeOut(range(progress, STEP_RADAR.start, STEP_RADAR.end));
  const diveT = easeIn(range(progress, STEP_DIVE.start, STEP_DIVE.end));

  // settle from 1.35 → 1.1 during the reveal, then push in up to 2.6
  const zoom = lerp(1, 1, revealT) + diveT * 1.5;

  const labelIn = range(progress, STEP_LABEL_IN.start, STEP_LABEL_IN.end);
  const labelOut = range(progress, STEP_LABEL_OUT.start, STEP_LABEL_OUT.end);

  hero.style.setProperty("--city-zoom", zoom);
  hero.style.setProperty("--city-blur", diveT * 6);
  hero.style.setProperty("--city-opacity", 1 - range(progress, STEP_FADE.start, STEP_FADE.end));
  hero.style.setProperty("--label", labelIn * (1 - labelOut));
}

function renderHero() {
  const progress = getSectionProgress(hero);

  hero.classList.toggle("is-scrolled", progress > 0.01);
  renderZoom(progress);
  renderText(progress);
  renderTextOut(progress);
  renderRadar(progress);
  renderCity(progress);
}


/* ---------- About: two lives, one man ---------- */

const about = document.querySelector(".about");

// hold on Matt, slide the divider across, then hold on Daredevil
const STEP_SPLIT = { start: 0.2, end: 0.8 };

function renderAbout() {
  const progress = getSectionProgress(about);
  const t = easeInOut(range(progress, STEP_SPLIT.start, STEP_SPLIT.end));

  about.style.setProperty("--split", `${lerp(100, 0, t)}%`);
  about.style.setProperty("--matt-zoom", lerp(1.1, 1, t));
  about.style.setProperty("--devil-zoom", lerp(1.15, 1, t));

  // fade the divider in and out so it doesn't sit on the screen edges
  about.style.setProperty("--divider-opacity", clamp(Math.min(t, 1 - t) * 12));
}


/* ---------- 3D showcase: models that turn as you scroll (mask + baton) ---------- */

// fade a callout in at the start of its step and out at the end
function calloutVisibility(progress, start, end) {
  const fadeIn = range(progress, start, start + 0.05);
  const fadeOut = range(progress, end - 0.05, end);
  return fadeIn * (1 - fadeOut);
}

// set up one showcase section and return a function that redraws it
function setupShowcase(section) {
  const model = section.querySelector(".showcase__model");
  const callouts = section.querySelectorAll(".showcase__callout");

  // settings come from the section's data- attributes in the HTML
  const startAngle = Number(section.dataset.startAngle);
  const turn = Number(section.dataset.turn);
  const pitch = section.dataset.pitch;
  const distance = section.dataset.distance;

  // pause the scroll-turning for a moment while someone drags the model
  let lastDragTime = 0;

  model.addEventListener("camera-change", (event) => {
    if (event.detail.source === "user-interaction") lastDragTime = performance.now();
  });

  return function renderShowcase() {
    const progress = getSectionProgress(section);
    section.style.setProperty("--showcase-progress", progress);

    callouts.forEach((callout) => {
      const show = calloutVisibility(progress, Number(callout.dataset.start), Number(callout.dataset.end));
      callout.style.setProperty("--show", show);
    });

    const isDragging = performance.now() - lastDragTime < 1500;
    if (isDragging) return;

    const angle = startAngle + progress * turn;
    model.cameraOrbit = `${angle}deg ${pitch} ${distance}`;
  };
}

const showcaseRenderers = [...document.querySelectorAll(".showcase")].map(setupShowcase);

function renderShowcases() {
  showcaseRenderers.forEach((render) => render());
}


/* ---------- Story: origin comic strip ---------- */

const comic = document.querySelector(".comic");
const comicTrack = comic.querySelector(".comic__track");
const comicPanels = comic.querySelectorAll(".comic__panel");

// if a panel image is missing, remove it so the red halftone placeholder shows
comic.querySelectorAll(".comic__panel img").forEach((img) => {
  img.addEventListener("error", () => img.remove());
  if (img.complete && img.naturalWidth === 0) img.remove(); // already failed before JS ran
});

function renderComic() {
  const progress = getSectionProgress(comic);

  // slide the track left until the last panel sits in the middle of the screen
  const lastPanel = comicPanels[comicPanels.length - 1];
  const maxShift = lastPanel.offsetLeft + lastPanel.offsetWidth / 2 - window.innerWidth / 2;
  comic.style.setProperty("--track-x", `${-progress * maxShift}px`);
  comic.style.setProperty("--strip-progress", progress);

  // "ink in" each panel as it moves towards the middle of the screen
  comicPanels.forEach((panel) => {
    const box = panel.getBoundingClientRect();
    const panelCenter = box.left + box.width / 2;
    const distance = Math.abs(panelCenter - window.innerWidth / 2) / window.innerWidth;

    panel.style.setProperty("--ink", clamp(1.4 - distance * 2.2));
  });
}


/* ---------- Story highlights: comic shelf from an array of objects ---------- */

const stories = [
  {
    title: { en: "The Death of Elektra", ar: "موت إلكترا" },
    author: "Frank Miller & Klaus Janson",
    year: 1982,
    issues: "Daredevil #181",
    language: { en: "English", ar: "الإنجليزية" },
    cover: "assets/images/highlights/death-of-elektra.jpg",
    focus: "50% 30%",
    summary: {
      en: "Bullseye is out of prison, and he's coming for the woman Matt loves.",
      ar: "خرج بولزآي من السجن، وهدفه المرأة التي يحبّها مات.",
    },
    synopsis: {
      en: "Bullseye escapes with one goal: to win back his place as the Kingpin's top assassin by killing Elektra, Matt's first love and the Kingpin's new enforcer. Their duel ends in one of the most famous deaths in comics, and leaves Daredevil at the edge of what he is willing to do to Bullseye.",
      ar: "يهرب بولزآي من السجن بهدف واحد: أن يستعيد مكانته كأول قاتل مأجور لدى كينغبن بقتل إلكترا، حبّ مات الأول وذراع كينغبن الجديدة. تنتهي مبارزتهما بواحدة من أشهر الميتات في تاريخ القصص المصوّرة، وتدفع ديرديفل إلى حافة ما هو مستعدّ لفعله ببولزآي.",
    },
  },
  {
    title: { en: "Welcome Back, Frank", ar: "مرحبًا بعودتك يا فرانك" },
    author: "Garth Ennis & Steve Dillon",
    year: 2000,
    issues: "The Punisher #3",
    language: { en: "English", ar: "الإنجليزية" },
    cover: "assets/images/highlights/welcome-back-frank.jpg",
    focus: "40% 40%",
    summary: {
      en: "The Punisher chains Daredevil to a rooftop and hands him a terrible choice.",
      ar: "يقيّد المعاقِب ديرديفل على سطح مبنى ويضعه أمام خيار رهيب.",
    },
    synopsis: {
      en: "When Daredevil tries to stop Frank Castle's war on the mob, Frank chains him to a chimney in the rain, puts a gun in his hand and makes him choose: let a gangster die, or shoot the Punisher himself. It is the clearest clash between the two men's ideas of justice.",
      ar: "حين يحاول ديرديفل إيقاف حرب فرانك كاسل على المافيا، يقيّده فرانك بمدخنة تحت المطر، ويضع مسدسًا في يده ويجبره على الاختيار: أن يترك رجل عصابات يموت، أو أن يطلق النار على المعاقِب نفسه. إنه أوضح صدام بين فكرتَي الرجلين عن العدالة.",
    },
  },
  {
    title: { en: "Mayor Fisk", ar: "العمدة فيسك" },
    author: "Charles Soule & Stefano Landini",
    year: 2018,
    issues: "Daredevil #595–600",
    language: { en: "English", ar: "الإنجليزية" },
    cover: "assets/images/highlights/mayor-fisk.jpg",
    focus: "28% 40%",
    summary: {
      en: "The Kingpin wins the election and becomes mayor of New York City.",
      ar: "يفوز كينغبن بالانتخابات ويصبح عمدة مدينة نيويورك.",
    },
    synopsis: {
      en: "Wilson Fisk is elected mayor of New York, legally. With the city's police and laws now on his side, he turns New York against masked heroes, and Matt has to fight him both on the streets as Daredevil and in the courtroom as a lawyer.",
      ar: "يُنتخب ويلسون فيسك عمدةً لنيويورك بشكل قانوني. ومع وقوف شرطة المدينة وقوانينها إلى جانبه، يقلب نيويورك ضد الأبطال المقنّعين، فيضطر مات إلى مواجهته في الشوارع بصفته ديرديفل، وفي المحكمة بصفته محاميًا.",
    },
  },
  {
    title: { en: "Bullseye in Red", ar: "بولزآي بالأحمر" },
    author: "Ann Nocenti & Kieron Dwyer",
    year: 1991,
    issues: "Daredevil #290",
    language: { en: "English", ar: "الإنجليزية" },
    cover: "assets/images/highlights/bullseye-as-daredevil.jpg",
    focus: "55% 30%",
    summary: {
      en: "Bullseye puts on the devil's suit and turns Daredevil's name against him.",
      ar: "يرتدي بولزآي بدلة الشيطان ويقلب اسم ديرديفل ضدّه.",
    },
    synopsis: {
      en: "In one of the strangest chapters of their rivalry, Bullseye takes on Daredevil's identity and wears the red suit himself, using the hero's own image as a weapon. Matt has to stop a killer who now looks exactly like him.",
      ar: "في واحد من أغرب فصول عداوتهما، ينتحل بولزآي هوية ديرديفل ويرتدي البدلة الحمراء بنفسه، مستخدمًا صورة البطل سلاحًا ضدّه. على مات أن يوقف قاتلًا يشبهه تمامًا.",
    },
  },
  {
    title: { en: "Devil's Reign", ar: "حكم الشيطان" },
    author: "Chip Zdarsky & Marco Checchetto",
    year: 2022,
    issues: "Devil's Reign #1–6",
    language: { en: "English", ar: "الإنجليزية" },
    cover: "assets/images/highlights/devils-reign.jpg",
    focus: "40% 40%",
    summary: {
      en: "Mayor Fisk outlaws heroes, and it ends in one last brutal fight.",
      ar: "يحظر العمدة فيسك الأبطال، وينتهي الأمر بمعركة أخيرة وحشية.",
    },
    synopsis: {
      en: "As mayor, Wilson Fisk bans superheroes from New York and hunts them with his own forces. The war becomes personal, and ends in a bloody showdown between Daredevil and the Kingpin that finally brings Fisk down.",
      ar: "بصفته عمدة، يحظر ويلسون فيسك الأبطال الخارقين في نيويورك ويطاردهم بقواته الخاصة. تتحوّل الحرب إلى ثأر شخصي، وتنتهي بمواجهة دامية بين ديرديفل وكينغبن تُسقط فيسك أخيرًا.",
    },
  },
];

const shelf = document.querySelector(".shelf");
const shelfRow = shelf.querySelector(".shelf__row");
const shelfText = document.querySelector(".shelf__text");
const shelfButton = document.querySelector(".shelf__button");
const storyModal = document.querySelector(".story-modal");
let activeStory = 0;

// build one cover button for a story object
function createCover(story, index) {
  const cover = document.createElement("button");
  cover.className = "cover";
  cover.type = "button";
  cover.style.setProperty("--focus", story.focus);
  cover.style.setProperty("--delay", `${index * 0.08}s`);
  cover.innerHTML = `<img src="${story.cover}" alt="" loading="lazy">`;

  // pick this cover on hover or keyboard focus, open details on click
  cover.addEventListener("mouseenter", () => selectStory(index));
  cover.addEventListener("focus", () => selectStory(index));
  cover.addEventListener("click", () => openStoryModal(stories[index]));

  // tilt toward the mouse and move the glare with it
  cover.addEventListener("mousemove", (event) => {
    const box = cover.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;

    cover.style.setProperty("--ry", `${(x - 0.5) * 24}deg`);
    cover.style.setProperty("--rx", `${(y - 0.5) * 16}deg`);
    cover.style.setProperty("--gx", `${x * 100}%`);
    cover.style.setProperty("--gy", `${y * 100}%`);
  });

  cover.addEventListener("mouseleave", () => {
    cover.style.removeProperty("--rx");
    cover.style.removeProperty("--ry");
  });

  return cover;
}

// give every cover button a spoken label in the current language
function labelCovers() {
  shelfRow.querySelectorAll(".cover").forEach((cover, index) => {
    const story = stories[index];
    cover.setAttribute("aria-label", `${localize(story.title)} (${story.year})`);
  });
}

// lift the chosen cover and show its details under the box
function selectStory(index) {
  const story = stories[index];
  activeStory = index;

  shelfRow.querySelectorAll(".cover").forEach((cover, i) => {
    cover.classList.toggle("is-active", i === index);
  });

  shelfText.querySelector(".shelf__meta").textContent = `${story.year} · ${story.issues} · ${localize(story.language)}`;
  shelfText.querySelector(".shelf__name").textContent = localize(story.title);
  shelfText.querySelector(".shelf__author").textContent = story.author;
  shelfText.querySelector(".shelf__summary").textContent = localize(story.summary);

  // restart the little fade-in animation
  shelfText.classList.remove("is-changing");
  void shelfText.offsetWidth;
  shelfText.classList.add("is-changing");
}

// fill the popup with one story's details and open it
function openStoryModal(story) {
  const cover = storyModal.querySelector(".story-modal__cover img");
  cover.style.visibility = "visible";
  cover.onerror = () => (cover.style.visibility = "hidden"); // missing image → show the red placeholder
  cover.src = story.cover;
  cover.alt = t("story.coverAlt").replace("{title}", localize(story.title));
  cover.style.objectPosition = story.focus;

  storyModal.querySelector(".story-modal__meta").textContent = `${story.year} · ${story.issues}`;
  storyModal.querySelector(".story-modal__title").textContent = localize(story.title);
  storyModal.querySelector(".story-modal__author").textContent = story.author;
  storyModal.querySelector(".story-modal__synopsis").textContent = localize(story.synopsis);
  storyModal.querySelector(".story-modal__tags").innerHTML = `
    <li>${localize(story.language)}</li>
    <li>${story.issues}</li>
  `;

  storyModal.showModal();
}

shelfButton.addEventListener("click", () => openStoryModal(stories[activeStory]));

// close with the ✕ button or by clicking the dark area outside the popup (Esc works by default)
storyModal.querySelector(".story-modal__close").addEventListener("click", () => storyModal.close());
storyModal.addEventListener("click", (event) => {
  if (event.target === storyModal) storyModal.close();
});

// covers rise into the box the first time the shelf scrolls into view
const shelfObserver = new IntersectionObserver(
  ([entry]) => {
    if (!entry.isIntersecting) return;
    shelf.classList.add("is-visible");
    shelfObserver.disconnect();
  },
  { threshold: 0.3 }
);

shelfRow.append(...stories.map(createCover));
labelCovers();
selectStory(0);
shelfObserver.observe(shelf);


/* ---------- Contact: form that switches between Matt and Daredevil ---------- */

const contact = document.querySelector(".contact");
const contactForm = contact.querySelector(".contact__form");
const contactSuccess = contact.querySelector(".contact__success");

// the name is required when writing to the lawyer, optional for an anonymous tip
// (all the wording for each mode lives in js/translations.js, e.g. "contact.devil.button")
const NAME_REQUIRED = { lawyer: true, devil: false };

// simple email check: something@something.something
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getMode() {
  return contactForm.elements.mode.value;
}

// text for the current mode, e.g. contactText("button") → "Signal the Devil"
function contactText(field) {
  return t(`contact.${getMode()}.${field}`);
}

// update labels, placeholders and colours for the chosen mode
function applyContactMode() {
  contact.classList.toggle("is-devil", getMode() === "devil");
  contact.querySelector('label[for="contact-name"]').textContent = contactText("nameLabel");
  contact.querySelector('label[for="contact-message"]').textContent = contactText("messageLabel");
  contactForm.elements.name.placeholder = contactText("namePlaceholder");
  contactForm.elements.message.placeholder = contactText("messagePlaceholder");
  contactForm.querySelector(".contact__submit").textContent = contactText("button");
  contactSuccess.textContent = "";
}

// show or clear the error message under one field
function setFieldError(input, message) {
  const field = input.closest(".contact__field");
  field.classList.toggle("is-invalid", Boolean(message));
  field.querySelector(".contact__error").textContent = message;
}

// check every field, return true if the form can be sent
function validateContactForm() {
  const { name, email, message } = contactForm.elements;
  let isValid = true;

  if (NAME_REQUIRED[getMode()] && name.value.trim() === "") {
    setFieldError(name, t("contact.errorName"));
    isValid = false;
  } else {
    setFieldError(name, "");
  }

  if (!EMAIL_PATTERN.test(email.value.trim())) {
    setFieldError(email, t("contact.errorEmail"));
    isValid = false;
  } else {
    setFieldError(email, "");
  }

  if (message.value.trim().length < 10) {
    setFieldError(message, t("contact.errorMessage"));
    isValid = false;
  } else {
    setFieldError(message, "");
  }

  return isValid;
}

contactForm.addEventListener("change", (event) => {
  if (event.target.name === "mode") applyContactMode();
});

// there's no server, so a valid form just shows a thank-you message
contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateContactForm()) return;

  const name = contactForm.elements.name.value.trim() || t("contact.friend");
  contactSuccess.textContent = contactText("success").replace("{name}", name);

  const mode = getMode();
  contactForm.reset();
  contactForm.elements.mode.value = mode; // keep the chosen mode after reset
});

applyContactMode();


/* ---------- Footer: newsletter sign-up ---------- */

const newsletterForm = document.querySelector(".footer__newsletter");
const newsletterMessage = newsletterForm.querySelector(".footer__message");

// reuses EMAIL_PATTERN from the contact form above
newsletterForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const email = newsletterForm.elements.email.value.trim();
  const isValid = EMAIL_PATTERN.test(email);

  newsletterForm.classList.toggle("is-invalid", !isValid);

  if (!isValid) {
    newsletterMessage.textContent = t("footer.newsletterInvalid");
    return;
  }

  newsletterMessage.textContent = t("footer.newsletterSuccess").replace("{email}", email);
  newsletterForm.reset();
});


/* ---------- Smooth scrolling to sections + active nav link ---------- */

const navLinks = document.querySelectorAll(".navbar__link");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// clicking any link to "#something" glides to that section instead of jumping
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });
});

// underline the nav link of the section you're currently in
function renderActiveNavLink() {
  const checkLine = window.scrollY + window.innerHeight * 0.4;
  let activeLink = navLinks[0];

  navLinks.forEach((link) => {
    const section = document.querySelector(link.getAttribute("href"));
    if (section && section.offsetTop <= checkLine) activeLink = link;
  });

  navLinks.forEach((link) => link.classList.toggle("is-active", link === activeLink));
}


/* ---------- Language switcher (EN / AR) ---------- */

const languageButtons = document.querySelectorAll(".navbar__lang-btn");

// swap every tagged element's text to the chosen language
function translatePage() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
    el.setAttribute("alt", t(el.dataset.i18nAlt));
  });
  document.title = t("meta.title");
}

function setLanguage(language) {
  currentLanguage = language;

  // Arabic reads right-to-left
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";

  translatePage();

  // parts of the page that are built by JavaScript
  heroWords = [...heroLines].flatMap(splitIntoWords);
  labelCovers();
  selectStory(activeStory);
  applyContactMode();
  contactForm.querySelectorAll(".contact__field").forEach((field) => {
    field.classList.remove("is-invalid");
    field.querySelector(".contact__error").textContent = "";
  });
  newsletterForm.classList.remove("is-invalid");
  newsletterMessage.textContent = "";
  setMusicButton(musicButton.classList.contains("is-playing"));

  languageButtons.forEach((button) => {
    const isActive = button.dataset.lang === language;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive);
  });

  localStorage.setItem("language", language); // remember the choice for next visit
  renderAll();
}

languageButtons.forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.lang));
});


/* ---------- Scroll loop ---------- */

let ticking = false;

function renderAll() {
  renderHero();
  renderAbout();
  renderShowcases();
  renderComic();
  renderActiveNavLink();
}

function onScroll() {
  if (ticking) return;
  ticking = true;

  requestAnimationFrame(() => {
    renderAll();
    ticking = false;
  });
}

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll);
setLanguage(localStorage.getItem("language") || "en"); 