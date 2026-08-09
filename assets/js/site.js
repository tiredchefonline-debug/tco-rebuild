(function () {
  "use strict";

  const body = document.body;
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-menu");

  function closeMenu() {
    if (!toggle || !menu) return;
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    body.classList.remove("nav-open");
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      const isOpen = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      body.classList.toggle("nav-open", isOpen);
    });

    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeMenu();
        toggle.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  function setHeaderState() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  setHeaderState();
  window.addEventListener("scroll", setHeaderState, { passive: true });

  document.querySelectorAll("[data-year]").forEach(function (node) {
    node.textContent = String(new Date().getFullYear());
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealNodes = document.querySelectorAll("[data-reveal]");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealNodes.forEach(function (node) { node.classList.add("is-visible"); });
  } else {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealNodes.forEach(function (node) { observer.observe(node); });
  }

  const rotatingWord = document.querySelector("[data-rotate-words]");
  if (rotatingWord && !reduceMotion) {
    let words = [];
    try {
      words = JSON.parse(rotatingWord.getAttribute("data-rotate-words") || "[]");
    } catch (error) {
      words = [];
    }

    if (words.length > 1) {
      let index = 0;
      window.setInterval(function () {
        rotatingWord.style.opacity = "0";
        window.setTimeout(function () {
          index = (index + 1) % words.length;
          rotatingWord.textContent = words[index];
          rotatingWord.style.opacity = "1";
        }, 180);
      }, 2600);
    }
  }

  const sitemapSearch = document.querySelector("[data-sitemap-search]");
  if (sitemapSearch) {
    const items = Array.from(document.querySelectorAll("[data-sitemap-item]"));
    const emptyState = document.querySelector("[data-sitemap-empty]");

    function filterSitemap() {
      const query = sitemapSearch.value.trim().toLowerCase();
      let visible = 0;

      items.forEach(function (item) {
        const match = item.textContent.toLowerCase().includes(query);
        item.hidden = !match;
        if (match) visible += 1;
      });

      if (emptyState) emptyState.hidden = visible !== 0;
    }

    sitemapSearch.addEventListener("input", filterSitemap);

    const initialQuery = new URLSearchParams(window.location.search).get("q");
    if (initialQuery) {
      sitemapSearch.value = initialQuery;
      filterSitemap();
    }
  }
})();
