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
  const monitorToggle = document.querySelector("#monitor-motion-toggle");
  const monitorMarquees = document.querySelector(".monitor-marquees");
  if (monitorToggle && monitorMarquees) {
    let paused = reduceMotion;
    const setMonitorState = (nextPaused) => {
      paused = nextPaused;
      monitorMarquees.classList.toggle("is-paused", paused);
      monitorToggle.setAttribute("aria-pressed", String(paused));
      monitorToggle.setAttribute("aria-label", paused ? "Play motion" : "Pause motion");
      monitorToggle.querySelector("span").textContent = paused ? "▶" : "Ⅱ";
      monitorToggle.querySelector("b").textContent = paused ? "Play motion" : "Pause motion";
    };

    setMonitorState(paused);
    monitorToggle.addEventListener("click", () => setMonitorState(!paused));
  }


  document.querySelector("#year").textContent = String(new Date().getFullYear());
})();