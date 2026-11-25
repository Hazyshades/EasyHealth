(() => {
  document.documentElement.classList.add("js");
  const config = window.EASYHEALTH_SITE_CONFIG || {};
  document.querySelectorAll("[data-app-link]").forEach((link) => {
    const destination = config[link.dataset.appLink];
    if (typeof destination === "string" && destination.trim()) link.href = destination;
  });

  document.querySelectorAll("[data-product-showcase]").forEach((showcase) => {
    const tabList = showcase.querySelector(".product-tabs");
    const tabs = [...showcase.querySelectorAll("[data-feature]")];
    const panels = [...showcase.querySelectorAll("[data-feature-panel]")];
    let activeIndex = 0;
    tabList.setAttribute("role", "tablist");
    const selectFeature = (index, focus = false) => {
      activeIndex = (index + tabs.length) % tabs.length;
      tabs.forEach((tab, position) => {
        const selected = position === activeIndex;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[position].hidden = !selected;
      });
      showcase.querySelector(".product-count").textContent =
        `${String(activeIndex + 1).padStart(2, "0")} / ${String(tabs.length).padStart(2, "0")}`;
      showcase.querySelector(".product-progress > span").style.width =
        `${((activeIndex + 1) / tabs.length) * 100}%`;
      if (focus) tabs[activeIndex].focus();
    };
    tabs.forEach((tab, index) => {
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", panels[index].id);
      panels[index].setAttribute("role", "tabpanel");
      panels[index].setAttribute("aria-labelledby", tab.id);
      panels[index].tabIndex = 0;
      tab.addEventListener("click", () => selectFeature(index));
      tab.addEventListener("keydown", (event) => {
        const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (direction || event.key === "Home" || event.key === "End") {
          event.preventDefault();
          selectFeature(event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : activeIndex + direction, true);
        }
      });
    });
    showcase.querySelectorAll("[data-feature-step]").forEach((button) => {
      button.addEventListener("click", () => selectFeature(activeIndex + Number(button.dataset.featureStep)));
    });
    selectFeature(0);
    showcase.classList.add("is-ready");
  });

  const menuButton = document.querySelector(".menu-button");
  const menuLabel = menuButton?.querySelector(".sr-only");
  const navigation = document.querySelector("#site-nav");
  if (menuButton && navigation) {
    const closeMenu = () => {
      menuButton.setAttribute("aria-expanded", "false");
      if (menuLabel) menuLabel.textContent = "Open navigation";
      navigation.classList.remove("is-open");
      document.body.style.overflow = "";
    };
    menuButton.addEventListener("click", () => {
      const isOpen = menuButton.getAttribute("aria-expanded") === "true";
      if (isOpen) closeMenu();
      else {
        menuButton.setAttribute("aria-expanded", "true");
        if (menuLabel) menuLabel.textContent = "Close navigation";
        navigation.classList.add("is-open");
        document.body.style.overflow = "hidden";
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
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = motionQuery.matches;
  const flutieRoot = document.querySelector("[data-flutie-hero]");
  const loadFlutie = () => {
    if (!flutieRoot || flutieRoot.dataset.flutieRequested === "true") return;
    flutieRoot.dataset.flutieRequested = "true";
    import("./assets/reference-authorized/flutie/FlutieHero.astro_astro_type_script_index_0_lang.BmV3fnua.js").catch((error) => {
      flutieRoot.classList.add("is-static");
      console.error("Failed to load hero motion", error);
    });
  };
  if (flutieRoot) {
    flutieRoot.classList.toggle("is-static", reduceMotion);
    if (!reduceMotion) loadFlutie();
    motionQuery.addEventListener("change", ({ matches }) => {
      reduceMotion = matches;
      flutieRoot.classList.toggle("is-static", matches);
      if (!matches) loadFlutie();
    });
  }
  if (window.lottie) {
    const players = new Map();
    const workflowPlayers = [];
    const workflowVisibility = new WeakMap();
    let workflowPaused = reduceMotion;
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
        element.classList.add("is-lottie-ready");
        if (reduceMotion) player.goToAndStop(0, true);
      });
      return player;
    };
    document.querySelectorAll(".workflow-animation[data-lottie]").forEach((element) => {
      const player = mountAnimation(element);
      workflowPlayers.push({ element, player });
      workflowVisibility.set(element, false);

      const observer = new IntersectionObserver(
        ([entry]) => {
          workflowVisibility.set(element, entry.isIntersecting);
          if (entry.isIntersecting && !workflowPaused) player.play();
          else player.pause();
        },
        { threshold: 0.35 },
      );
      observer.observe(element);
    });
    motionQuery.addEventListener("change", ({ matches }) => {
      workflowPaused = matches;
      workflowPlayers.forEach(({ element, player }) => {
        if (workflowPaused) player.goToAndStop(0, true);
        else if (workflowVisibility.get(element)) player.play();
      });
    });
    const monitorAnimation = document.querySelector(".monitor-animation");
    const monitorMarquees = document.querySelector(".monitor-marquees");
    if (monitorAnimation) {
      const monitorPlayer = mountAnimation(monitorAnimation);
      let paused = reduceMotion;
      let monitorVisible = false;
      const setMonitorState = (nextPaused) => {
        paused = nextPaused;
        monitorMarquees?.classList.toggle("is-paused", paused);
        if (paused || !monitorVisible) monitorPlayer.pause();
        else monitorPlayer.play();
      };
      setMonitorState(reduceMotion);
      const observer = new IntersectionObserver(
        ([entry]) => {
          monitorVisible = entry.isIntersecting;
          if (monitorVisible && !paused) monitorPlayer.play();
          else monitorPlayer.pause();
        },
        { threshold: 0.25 },
      );
      observer.observe(monitorAnimation);
      motionQuery.addEventListener("change", ({ matches }) => {
        setMonitorState(matches);
      });
    }
  }


  document.querySelector("#year").textContent = String(new Date().getFullYear());
})();