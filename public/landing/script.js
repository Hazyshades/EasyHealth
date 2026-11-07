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
  const bindMotionToggle = (toggle, surface, surfaceClass) => {
    if (!toggle || !surface) return;
    let paused = reduceMotion;
    const setState = (nextPaused) => {
      paused = nextPaused;
      surface.classList.toggle(surfaceClass, paused);
      toggle.setAttribute("aria-pressed", String(paused));
      toggle.setAttribute("aria-label", paused ? "Play motion" : "Pause motion");
      toggle.querySelector("span").textContent = paused ? "▶" : "Ⅱ";
      toggle.querySelector("b").textContent = paused ? "Play motion" : "Pause motion";
    };

    setState(paused);
    toggle.addEventListener("click", () => setState(!paused));
  };

  bindMotionToggle(
    document.querySelector("#hero-motion-toggle"),
    document.querySelector(".hero-visual-frame"),
    "is-paused",
  );
  bindMotionToggle(
    document.querySelector("#monitor-motion-toggle"),
    document.querySelector(".monitor-marquees"),
    "is-paused",
  );


  document.querySelector("#year").textContent = String(new Date().getFullYear());
})();