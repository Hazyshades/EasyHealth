(() => {
  document.documentElement.classList.add("js");
  const config = window.EASYHEALTH_SITE_CONFIG || {};
  document.querySelectorAll("[data-app-link]").forEach((link) => {
    const destination = config[link.dataset.appLink];
    if (typeof destination === "string" && destination.trim()) link.href = destination;
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
  const videosByGroup = new Map();
  const videoGroupByElement = new WeakMap();
  document.querySelectorAll("[data-landing-video]").forEach((video) => {
    const group = video.dataset.videoGroup || "default";
    if (!videosByGroup.has(group)) videosByGroup.set(group, []);
    videosByGroup.get(group).push(video);
    videoGroupByElement.set(video, group);
    video.addEventListener("error", () => video.closest(".video-hero, .video-frame, .monitor-video-frame")?.classList.add("is-video-error"));
  });

  const userPaused = new Map([...videosByGroup.keys()].map((group) => [group, false]));
  const videoVisibility = new WeakMap();
  const syncButton = (button, paused, group) => {
    button.setAttribute("aria-pressed", String(paused));
    button.setAttribute("aria-label", `${paused ? "Play" : "Pause"} ${group} video`);
    const icon = button.querySelector("span");
    const label = button.querySelector("b");
    if (icon) icon.textContent = paused ? "▶" : "Ⅱ";
    if (label) label.textContent = paused ? "Play video" : "Pause video";
  };
  const setVideoState = (video, group, forcePaused = false) => {
    const paused = forcePaused || reduceMotion || userPaused.get(group) || !videoVisibility.get(video);
    if (paused) video.pause();
    else video.play().catch(() => {});
  };
  const setGroupState = (group, forcePaused) => {
    const videos = videosByGroup.get(group) || [];
    videos.forEach((video) => setVideoState(video, group, forcePaused));
    document.querySelectorAll(`[data-video-toggle="${group}"]`).forEach((button) => syncButton(button, forcePaused, group));
  };
  const videoObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          const group = videoGroupByElement.get(video);
          videoVisibility.set(video, entry.isIntersecting);
          setVideoState(video, group);
        });
      }, { threshold: 0.2 })
    : null;
  const isInitiallyVisible = (video) => {
    const bounds = video.getBoundingClientRect();
    return bounds.bottom > 0 && bounds.top < window.innerHeight;
  };

  videosByGroup.forEach((videos, group) => {
    videos.forEach((video) => {
      videoVisibility.set(video, videoObserver ? isInitiallyVisible(video) : true);
      videoObserver?.observe(video);
      video.addEventListener("loadeddata", () => setVideoState(video, group));
    });
    setGroupState(group, reduceMotion);
  });

  document.querySelectorAll("[data-video-toggle]").forEach((button) => {
    const group = button.dataset.videoToggle;
    if (!videosByGroup.has(group)) return;
    button.addEventListener("click", () => {
      if (reduceMotion) return;
      userPaused.set(group, !userPaused.get(group));
      setGroupState(group, userPaused.get(group));
    });
  });

  const applyMotionPreference = ({ matches }) => {
    reduceMotion = matches;
    videosByGroup.forEach((_, group) => setGroupState(group, matches || userPaused.get(group)));
  };
  if (typeof motionQuery.addEventListener === "function") motionQuery.addEventListener("change", applyMotionPreference);
  else motionQuery.addListener(applyMotionPreference);

  const year = document.querySelector("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();