// Admin page logic. Requires Supabase Auth + Postgres (see menu-data.js).
const gate = document.getElementById("admin-gate");
const main = document.getElementById("admin-main");
const emailInput = document.getElementById("admin-email");
const passwordInput = document.getElementById("admin-password");
const unlockButton = document.getElementById("admin-unlock");
const signOutButton = document.getElementById("admin-signout");
const gateError = document.getElementById("admin-gate-error");
const statusEl = document.getElementById("admin-status");
const listEl = document.getElementById("admin-item-list");
const addForm = document.getElementById("admin-add-form");
const resetButton = document.getElementById("admin-reset");

let items = [];
let unsubscribeItems = null;

onAdminAuthChanged((user) => {
  if (user) {
    gate.hidden = true;
    main.hidden = false;
    if (!unsubscribeItems) {
      unsubscribeItems = subscribeMenuItems((data) => {
        items = data;
        renderList();
      });
    }
  } else {
    gate.hidden = false;
    main.hidden = true;
    if (unsubscribeItems) {
      unsubscribeItems();
      unsubscribeItems = null;
    }
  }
});

async function tryUnlock() {
  gateError.textContent = "";
  try {
    await signInAdmin(emailInput.value.trim(), passwordInput.value);
    passwordInput.value = "";
  } catch (error) {
    gateError.textContent = "Sign-in failed: check your email and password.";
    console.error(error);
  }
}

unlockButton.addEventListener("click", tryUnlock);
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") tryUnlock();
});

signOutButton.addEventListener("click", () => {
  signOutAdmin();
});

function showStatus(message) {
  statusEl.textContent = message;
  setTimeout(() => {
    if (statusEl.textContent === message) statusEl.textContent = "";
  }, 2500);
}

async function persist() {
  try {
    await saveMenuItems(items);
    showStatus("Saved.");
  } catch (error) {
    showStatus(error.message || "Could not save changes.");
    console.error(error);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderList() {
  listEl.innerHTML = "";

  if (!items.length) {
    listEl.innerHTML = "<p>No menu items yet — add one above.</p>";
    return;
  }

  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "admin-card";

    const heading = document.createElement("h2");
    heading.textContent = item.name || "Untitled item";

    const nameField = buildField("Name", "text", item.name, (value) => {
      items[index].name = value;
      heading.textContent = value || "Untitled item";
      persist();
    });

    const descLabel = document.createElement("label");
    descLabel.textContent = "Description";
    descLabel.style.cssText = "font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#666b62;";
    const descField = document.createElement("div");
    descField.className = "admin-field";
    const descTextarea = document.createElement("textarea");
    descTextarea.value = item.description || "";
    descTextarea.addEventListener("change", () => {
      items[index].description = descTextarea.value;
      persist();
    });
    descField.append(descLabel, descTextarea);

    const availableLabel = document.createElement("label");
    availableLabel.className = "admin-checkbox";
    const availableCheckbox = document.createElement("input");
    availableCheckbox.type = "checkbox";
    availableCheckbox.checked = item.available !== false;
    availableCheckbox.addEventListener("change", () => {
      items[index].available = availableCheckbox.checked;
      persist();
    });
    availableLabel.append(availableCheckbox, " Available this week");

    const priceField = buildField("Price (USD)", "number", item.price, (value) => {
      items[index].price = value;
      persist();
    });

    const preview = document.createElement("div");
    preview.className = "admin-preview";
    const previewImg = document.createElement("img");
    previewImg.alt = "";
    const updatePreview = () => {
      if (isSafeImageSrc(items[index].image)) {
        previewImg.src = items[index].image;
        preview.hidden = false;
      } else {
        preview.hidden = true;
      }
    };
    preview.append(previewImg);
    updatePreview();

    const imageUrlField = buildField("Picture URL (https://…)", "url", isSafeImageSrc(item.image) && item.image.startsWith("https://") ? item.image : "", (value) => {
      items[index].image = value.trim();
      updatePreview();
      persist();
    });

    const fileField = document.createElement("div");
    fileField.className = "admin-field";
    const fileLabel = document.createElement("label");
    fileLabel.textContent = "Or upload a picture";
    fileLabel.style.cssText = descLabel.style.cssText;
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const dataUrl = await fileToDataUrl(file);
      items[index].image = dataUrl;
      imageUrlField.querySelector("input").value = "";
      updatePreview();
      persist();
    });
    fileField.append(fileLabel, fileInput);

    const actions = document.createElement("div");
    actions.className = "admin-actions";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "admin-btn admin-btn-danger";
    deleteButton.textContent = "Remove item";
    deleteButton.addEventListener("click", () => {
      if (!confirm(`Remove "${items[index].name || "this item"}" from the menu?`)) return;
      items.splice(index, 1);
      persist();
      renderList();
    });
    actions.append(document.createElement("span"), deleteButton);

    card.append(heading, nameField, descField, availableLabel, priceField, preview, imageUrlField, fileField, actions);
    listEl.append(card);
  });
}

function buildField(labelText, type, value, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "admin-field";
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = type;
  input.value = value || "";
  if (type === "number") {
    input.min = "0";
    input.step = "0.01";
  }
  input.addEventListener("change", () => onChange(input.value));
  wrap.append(label, input);
  return wrap;
}

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.getElementById("new-name").value.trim();
  const description = document.getElementById("new-description").value.trim();
  const price = document.getElementById("new-price").value.trim();
  const urlValue = document.getElementById("new-image-url").value.trim();
  const fileInput = document.getElementById("new-image-file");
  const available = document.getElementById("new-available").checked;

  if (!name) return;

  let image = "";
  if (fileInput.files[0]) {
    image = await fileToDataUrl(fileInput.files[0]);
  } else if (urlValue.startsWith("https://")) {
    image = urlValue;
  }

  items.push({ id: makeMenuItemId(), name, description, price, image, available });
  persist();
  renderList();
  addForm.reset();
  document.getElementById("new-preview").hidden = true;
});

document.getElementById("new-image-url").addEventListener("input", (event) => {
  const preview = document.getElementById("new-preview");
  const previewImg = document.getElementById("new-preview-img");
  const value = event.target.value.trim();
  if (value.startsWith("https://")) {
    previewImg.src = value;
    preview.hidden = false;
  } else {
    preview.hidden = true;
  }
});

document.getElementById("new-image-file").addEventListener("change", async (event) => {
  const preview = document.getElementById("new-preview");
  const previewImg = document.getElementById("new-preview-img");
  const file = event.target.files[0];
  if (!file) {
    preview.hidden = true;
    return;
  }
  previewImg.src = await fileToDataUrl(file);
  preview.hidden = false;
});

resetButton.addEventListener("click", () => {
  if (!confirm("Reset the menu to the original default items? This cannot be undone.")) return;
  items = DEFAULT_MENU_ITEMS.map((item) => ({ ...item }));
  persist();
  renderList();
});
