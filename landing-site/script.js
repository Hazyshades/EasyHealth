(() => {
  document.documentElement.classList.add("js");
  const config = window.EASYHEALTH_SITE_CONFIG || {};
  document.querySelectorAll("[data-app-link]").forEach((link) => {
    const destination = config[link.dataset.appLink];
    if (typeof destination === "string" && destination.trim()) link.href = destination;
  });

  const menuButton = document.querySelector(".menu-button");
  const navigation = document.querySelector("#site-nav");
  if (menuButton && navigation) {
    const menuLabel = menuButton.querySelector(".sr-only");
    const setMenuState = (isOpen) => {
      menuButton.setAttribute("aria-expanded", String(isOpen));
      navigation.classList.toggle("is-open", isOpen);
      document.body.style.overflow = isOpen ? "hidden" : "";
      if (menuLabel) menuLabel.textContent = isOpen ? "Close navigation" : "Open navigation";
    };
    const closeMenu = () => setMenuState(false);
    menuButton.addEventListener("click", () => {
      const isOpen = menuButton.getAttribute("aria-expanded") === "true";
      if (isOpen) closeMenu();
      else {
        setMenuState(true);
        navigation.querySelector("a")?.focus();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
        closeMenu();
        menuButton.focus();
      }
    });
    navigation.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const flutieRoot = document.querySelector("[data-flutie-hero]");
  const fluteControl = document.querySelector(".flute-play-pause-button");
  const heroFrame = document.querySelector(".hero-visual-frame");
  const setHeroMotionState = (isPlaying) => {
    const paused = !isPlaying;
    heroFrame?.classList.toggle("is-paused", paused);
    if (!fluteControl) return;
    fluteControl.setAttribute("aria-pressed", String(paused));
    fluteControl.setAttribute("aria-label", isPlaying ? "Pause hero motion" : "Play hero motion");
    fluteControl.querySelector(".flute-play-icon").style.display = isPlaying ? "none" : "block";
    fluteControl.querySelector(".flute-pause-icon").style.display = isPlaying ? "block" : "none";
  };
  if (flutieRoot) {
    flutieRoot.addEventListener("flutiehero:playback-change", ({ detail }) => {
      if (typeof detail?.isPlaying === "boolean") setHeroMotionState(detail.isPlaying);
    });
    if (flutieRoot.dataset.flutiePlaying === "false") setHeroMotionState(false);
  }
  fluteControl?.addEventListener("click", () => {
    const isPaused = heroFrame?.classList.contains("is-paused") ?? fluteControl.getAttribute("aria-pressed") === "true";
    setHeroMotionState(!isPaused);
  });

  const players = new Map();
  const mountAnimation = (element) => {
    if (!window.lottie || players.has(element)) return players.get(element) || null;
    const player = window.lottie.loadAnimation({
      container: element,
      renderer: "svg",
      loop: true,
      autoplay: false,
      path: element.dataset.lottie,
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    });
    players.set(element, player);
    player.addEventListener("DOMLoaded", () => {
      element.classList.add("is-lottie-ready");
      if (reduceMotion) player.goToAndStop(0, true);
    });
    return player;
  };
  const observeAnimation = (element, player, threshold) => {
    if (!player || reduceMotion) return;
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? player.play() : player.pause()),
      { threshold },
    );
    observer.observe(element);
  };

  document.querySelectorAll(".workflow-animation[data-lottie]").forEach((element) => {
    observeAnimation(element, mountAnimation(element), 0.35);
  });

  const monitorAnimation = document.querySelector(".monitor-animation[data-lottie]");
  const monitorToggle = document.querySelector("#monitor-motion-toggle");
  const monitorMarquees = document.querySelector(".monitor-marquees");
  const monitorPlayer = monitorAnimation ? mountAnimation(monitorAnimation) : null;
  let monitorPaused = reduceMotion;
  const setMonitorState = (nextPaused) => {
    monitorPaused = nextPaused;
    monitorMarquees?.classList.toggle("is-paused", monitorPaused);
    if (monitorToggle) {
      monitorToggle.setAttribute("aria-pressed", String(monitorPaused));
      monitorToggle.setAttribute("aria-label", monitorPaused ? "Play motion" : "Pause motion");
      monitorToggle.querySelector("span").textContent = monitorPaused ? "▶" : "Ⅱ";
      monitorToggle.querySelector("b").textContent = monitorPaused ? "Play motion" : "Pause motion";
    }
    if (monitorPlayer) {
      if (monitorPaused) monitorPlayer.pause();
      else monitorPlayer.play();
    }
  };
  setMonitorState(monitorPaused);
  if (monitorAnimation && monitorPlayer && !reduceMotion) {
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting && !monitorPaused ? monitorPlayer.play() : monitorPlayer.pause()),
      { threshold: 0.25 },
    );
    observer.observe(monitorAnimation);
  }
  monitorToggle?.addEventListener("click", () => setMonitorState(!monitorPaused));

  document.querySelector("#year").textContent = String(new Date().getFullYear());
})();