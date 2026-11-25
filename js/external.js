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
  musicButton.setAttribute("aria-label", isPlaying ? "Stop music" : "Play music");
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

const heroWords = [...heroLines].flatMap(splitIntoWords);



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
  hero.style.setProperty("--ring-opacity", 1 - range(progress, 0.6, 0.68));

  // hide the intro video once the city covers the whole screen
  hero.style.setProperty("--video-opacity", 1 - range(progress, 0.6, 0.68));
}

// Step 4: location tag fades in, then the camera dives into the city and fades to black
function renderCity(progress) {
  const revealT = easeOut(range(progress, STEP_RADAR.start, STEP_RADAR.end));
  const diveT = easeIn(range(progress, STEP_DIVE.start, STEP_DIVE.end));

  // settle from 1.35 → 1.1 during the reveal, then push in up to 2.6
  const zoom = lerp(1.35, 1.1, revealT) + diveT * 1.5;

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


const STEP_SPLIT = { start: 0.2, end: 0.8 };

function renderAbout() {
  const progress = getSectionProgress(about);
  const t = easeInOut(range(progress, STEP_SPLIT.start, STEP_SPLIT.end));

  about.style.setProperty("--split", `${lerp(100, 0, t)}%`);
  about.style.setProperty("--matt-zoom", lerp(1.1, 1, t));
  about.style.setProperty("--devil-zoom", lerp(1.15, 1, t));


  about.style.setProperty("--divider-opacity", clamp(Math.min(t, 1 - t) * 12));
}


/* ---------- Scroll loop ---------- */


let ticking = false;

function renderAll() {
  renderHero();
  renderAbout();
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
renderAll();