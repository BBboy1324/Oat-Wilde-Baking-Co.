const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  siteNav.classList.toggle("is-open", !isOpen);
});

siteNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
    siteNav.classList.remove("is-open");
  }
});

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

const menuBoard = document.querySelector("[data-menu-board]");
if (menuBoard && typeof subscribeMenuItems === "function") {
  subscribeMenuItems((items) => renderMenuBoard(menuBoard, items));
}

function renderMenuBoard(container, items) {
  if (!items.length) {
    container.innerHTML = "<p>The menu is being refreshed — please check back soon.</p>";
    return;
  }

  container.innerHTML = "";
  items.forEach((item, index) => {
    const article = document.createElement("article");
    article.className = "menu-item";
    if (item.available === false) article.classList.add("is-unavailable");

    const number = document.createElement("span");
    number.className = "menu-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const photo = document.createElement(isSafeImageSrc(item.image) ? "img" : "span");
    photo.className = "menu-photo";
    if (isSafeImageSrc(item.image)) {
      photo.src = item.image;
      photo.alt = "";
      photo.loading = "lazy";
    } else {
      photo.classList.add("menu-photo-empty");
      photo.setAttribute("aria-hidden", "true");
    }

    const copy = document.createElement("div");
    copy.className = "menu-copy";
    const heading = document.createElement("h2");
    heading.textContent = item.name || "Untitled item";
    const desc = document.createElement("p");
    desc.textContent = item.description || "";
    copy.append(heading, desc);
    if (item.available === false) {
      const badge = document.createElement("span");
      badge.className = "menu-unavailable-badge";
      badge.textContent = "Unavailable this week";
      copy.append(badge);
    }

    const price = document.createElement("span");
    price.className = "menu-price";
    price.textContent = item.price ? `$${item.price}` : "";

    article.append(number, photo, copy, price);
    container.append(article);
  });
}