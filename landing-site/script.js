(() => {
  document.documentElement.classList.add("js");

  const config = window.EASYHEALTH_SITE_CONFIG || {};
  document.querySelectorAll("[data-app-link]").forEach((link) => {
    const destination = config[link.dataset.appLink];
    if (typeof destination === "string" && destination.trim()) {
      link.href = destination;
    }
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
      if (isOpen) {
        closeMenu();
        return;
      }

      menuButton.setAttribute("aria-expanded", "true");
      if (menuLabel) menuLabel.textContent = "Close navigation";
      navigation.classList.add("is-open");
      document.body.style.overflow = "hidden";
      navigation.querySelector("a")?.focus();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
        closeMenu();
        menuButton.focus();
      }
    });

    navigation.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a")) {
        closeMenu();
      }
    });
  }

  const year = document.querySelector("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
