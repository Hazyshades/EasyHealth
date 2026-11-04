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
  const flutieControl = document.querySelector(".flute-play-pause-button");
  if (flutieRoot && flutieControl) {
    flutieRoot.addEventListener("flutiehero:playback-change", ({ detail }) => {
      const isPlaying = detail.isPlaying;
      flutieControl.setAttribute("aria-pressed", String(!isPlaying));
      flutieControl.setAttribute("aria-label", isPlaying ? "Pause hero motion" : "Play hero motion");
    });
  }
  if (window.lottie) {
    const players = new Map();
    const mountAnimation = (element) => {
      if (players.has(element)) return players.get(element);
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
        if (reduceMotion) player.goToAndStop(0, true);
      });
      return player;
    };
    document.querySelectorAll(".workflow-animation").forEach((element) => {
      const player = mountAnimation(element);
      if (reduceMotion) return;
      const observer = new IntersectionObserver(
        ([entry]) => (entry.isIntersecting ? player.play() : player.pause()),
        { threshold: 0.35 },
      );
      observer.observe(element);
    });
    const monitorAnimation = document.querySelector(".monitor-animation");
    const monitorToggle = document.querySelector("#monitor-motion-toggle");
    const monitorMarquees = document.querySelector(".monitor-marquees");
    if (monitorAnimation && monitorToggle) {
      const monitorPlayer = mountAnimation(monitorAnimation);
      monitorPlayer.addEventListener("DOMLoaded", () => monitorAnimation.classList.add("is-lottie-ready"));
      let paused = reduceMotion;
      const setMonitorState = (nextPaused) => {
        paused = nextPaused;
        monitorMarquees?.classList.toggle("is-paused", paused);
        monitorToggle.setAttribute("aria-pressed", String(paused));
        monitorToggle.setAttribute("aria-label", paused ? "Play motion" : "Pause motion");
        monitorToggle.querySelector("span").textContent = paused ? "▶" : "Ⅱ";
        monitorToggle.querySelector("b").textContent = paused ? "Play motion" : "Pause motion";
        if (paused) monitorPlayer.pause();
        else monitorPlayer.play();
      };
      setMonitorState(reduceMotion);
      if (!reduceMotion) {
        const observer = new IntersectionObserver(
          ([entry]) => (entry.isIntersecting && !paused ? monitorPlayer.play() : monitorPlayer.pause()),
          { threshold: 0.25 },
        );
        observer.observe(monitorAnimation);
      }
      monitorToggle.addEventListener("click", () => setMonitorState(!paused));
    }
  }


  document.querySelector("#year").textContent = String(new Date().getFullYear());
})();