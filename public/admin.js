(() => {
  // Authentication & Layout Screens
  const loginScreen = document.getElementById("login-screen");
  const appLayout = document.getElementById("app-layout");
  const toast = document.getElementById("toast");

  // Login form elements
  const loginForm = document.getElementById("login-form");
  const loginSubmitBtn = document.getElementById("login-submit-btn");
  const forgotPasswordButton = document.getElementById("forgot-password");
  const loginHelp = document.getElementById("login-help");
  const signOutBtn = document.getElementById("sign-out");
  const signedInUserText = document.getElementById("signed-in-user-text");

  // Sidebar & Navigation
  const appSidebar = document.getElementById("app-sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
  const navItems = document.querySelectorAll(".sidebar-nav .nav-item[data-tab]");
  const breadcrumbLabel = document.getElementById("breadcrumb-label");
  const advertsCountBadge = document.getElementById("adverts-count-badge");
  const accessoriesCountBadge = document.getElementById("accessories-count-badge");

  // Theme Toggles (both on login screen and header)
  const loginThemeToggle = document.getElementById("login-theme-toggle");
  const headerThemeToggle = document.getElementById("header-theme-toggle");

  // System status
  const dbDot = document.getElementById("db-dot");
  const dbStatusText = document.getElementById("db-status-text");
  const supabaseStatusDetail = document.getElementById("supabase-status-detail");
  const copySqlBtn = document.getElementById("copy-sql-btn");
  const copyEnvBtn = document.getElementById("copy-env-btn");

  // Forms and lists
  const advertForm = document.getElementById("advert-form");
  const accessoryForm = document.getElementById("accessory-form");
  const postList = document.getElementById("post-list");
  const accessoryList = document.getElementById("accessory-list");
  const saveAdvert = document.getElementById("save-advert");
  const saveAccessory = document.getElementById("save-accessory");
  const cancelEdit = document.getElementById("cancel-edit");
  const cancelAccessoryEdit = document.getElementById("cancel-accessory-edit");

  // Advert inputs
  const advertTag = document.getElementById("advert-tag");
  const advertTitle = document.getElementById("advert-title");
  const advertBody = document.getElementById("advert-body");
  const advertImage = document.getElementById("advert-image");
  const advertButtonLabel = document.getElementById("advert-button-label");
  const advertButtonUrl = document.getElementById("advert-button-url");
  const advertPublished = document.getElementById("advert-published");
  const advertCharCount = document.getElementById("advert-char-count");
  const advertDropzone = document.getElementById("advert-dropzone");
  const advertFileInfo = document.getElementById("advert-file-info");

  // Accessory inputs
  const accessoryDropzone = document.getElementById("accessory-dropzone");
  const accessoryImage = document.getElementById("accessory-image");
  const accessoryFileInfo = document.getElementById("accessory-file-info");

  // Live preview elements
  const previewCard = document.getElementById("preview-card");
  const previewPhotoWrap = document.getElementById("preview-photo-wrap");
  const previewPhoto = document.getElementById("preview-photo");
  const previewTag = document.getElementById("preview-tag");
  const previewTitle = document.getElementById("preview-title");
  const previewBody = document.getElementById("preview-body");
  const previewLink = document.getElementById("preview-link");
  const previewLinkText = document.getElementById("preview-link-text");

  let editingAdvert = null;
  let editingAccessory = null;
  let adverts = [];
  let accessories = [];
  let toastTimer = null;
  let previewPhotoBlobUrl = null;

  // =========================================================
  // THEME SWITCHING (LIGHT DEFAULT, WORKS ON LOGIN & STUDIO)
  // =========================================================
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("learnotech_theme", theme);

    const isDark = theme === "dark";
    document.querySelectorAll(".theme-sun-icon").forEach(icon => icon.hidden = !isDark);
    document.querySelectorAll(".theme-moon-icon").forEach(icon => icon.hidden = isDark);
    document.querySelectorAll(".theme-text").forEach(txt => txt.textContent = isDark ? "Light" : "Dark");
  }

  const initialTheme = localStorage.getItem("learnotech_theme") || "light";
  applyTheme(initialTheme);

  [loginThemeToggle, headerThemeToggle].forEach(btn => {
    if (btn) {
      btn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        applyTheme(current === "dark" ? "light" : "dark");
      });
    }
  });

  // =========================================================
  // MOBILE DRAWER TOGGLE
  // =========================================================
  function toggleMobileSidebar(open) {
    if (appSidebar) appSidebar.classList.toggle("open", open);
    if (sidebarOverlay) sidebarOverlay.classList.toggle("open", open);
  }

  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener("click", () => {
      const isOpen = appSidebar.classList.contains("open");
      toggleMobileSidebar(!isOpen);
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", () => {
      toggleMobileSidebar(false);
    });
  }

  // =========================================================
  // NAVIGATION TAB SWITCHING VIA FIXED SIDEBAR
  // =========================================================
  const tabTitles = {
    "tab-adverts": "Updates & Adverts",
    "tab-accessories": "Sale Items & Catalog",
    "tab-supabase": "Supabase Database & SQL"
  };

  function switchTab(tabId) {
    navItems.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    document.querySelectorAll(".tab-content").forEach((section) => {
      section.hidden = section.id !== tabId;
    });
    if (breadcrumbLabel && tabTitles[tabId]) {
      breadcrumbLabel.textContent = tabTitles[tabId];
    }
    toggleMobileSidebar(false);
  }

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Notification Toast Helper
  function showToast(message, type = "info") {
    if (!message) {
      toast.hidden = true;
      return;
    }
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast-box ${type}`;
    toast.hidden = false;
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 4000);
  }

  // Button loader helper
  function setButtonState(button, isLoading, loadingText = "Saving…", normalText = "Submit") {
    button.disabled = isLoading;
    const spinner = button.querySelector(".btn-spinner");
    const textSpan = button.querySelector(".btn-text");
    if (spinner) spinner.hidden = !isLoading;
    if (textSpan) textSpan.textContent = isLoading ? loadingText : normalText;
  }

  // API helper
  async function api(url, options = {}) {
    const settings = { ...options };
    settings.credentials = "same-origin";
    settings.headers = { Accept: "application/json", ...(settings.headers || {}) };
    const response = await fetch(url, settings);
    let result = null;
    try { result = await response.json(); } catch (_) {}
    if (!response.ok) {
      const msg = (result && (result.detail || result.message)) || `Server returned ${response.status}.`;
      throw new Error(msg);
    }
    return result;
  }

  // Toggle authentication views (completely separate blank login vs 100vh app layout)
  function setSignedIn(signedIn) {
    loginScreen.hidden = signedIn;
    appLayout.hidden = !signedIn;
    if (signedInUserText) signedInUserText.textContent = signedIn ? "Admin session" : "Guest";
    const label = document.getElementById("signed-in-as");
    if (label) label.textContent = signedIn ? "Authenticated" : "";
  }

  // Live Preview Updating Engine
  function updateLivePreview() {
    if (!previewCard) return;

    // Tag
    const tagVal = advertTag.value.trim() || "What's new";
    previewTag.textContent = tagVal;

    // Title
    const titleVal = advertTitle.value.trim() || "Your Headline Appears Here";
    previewTitle.textContent = titleVal;

    // Body & Char count
    const bodyVal = advertBody.value;
    advertCharCount.textContent = `${bodyVal.length} / 600`;
    previewBody.textContent = bodyVal.trim() || "Type in the form to see your update rendered live exactly as customers will see it.";

    // Action button
    const btnText = advertButtonLabel.value.trim();
    const btnUrl = advertButtonUrl.value.trim();
    if (btnText || btnUrl) {
      previewLinkText.textContent = btnText || "Learn more";
      previewLink.href = btnUrl || "#";
      previewLink.hidden = false;
    } else {
      previewLinkText.textContent = "Learn more";
      previewLink.href = "#";
      previewLink.hidden = false;
    }

    // Photo preview
    let displayImageUrl = null;
    if (advertImage.files && advertImage.files[0]) {
      if (!previewPhotoBlobUrl) {
        previewPhotoBlobUrl = URL.createObjectURL(advertImage.files[0]);
      }
      displayImageUrl = previewPhotoBlobUrl;
    } else if (editingAdvert && editingAdvert.image_url) {
      displayImageUrl = editingAdvert.image_url;
    }

    if (displayImageUrl) {
      previewPhoto.src = displayImageUrl;
      previewPhotoWrap.hidden = false;
      previewCard.classList.add("has-photo");
    } else {
      previewPhotoWrap.hidden = true;
      previewCard.classList.remove("has-photo");
    }
  }

  // Forgot password toggle
  if (forgotPasswordButton && loginHelp) {
    forgotPasswordButton.addEventListener("click", () => {
      loginHelp.hidden = !loginHelp.hidden;
      forgotPasswordButton.setAttribute("aria-expanded", String(!loginHelp.hidden));
    });
  }

  // File dropzone handlers
  function setupDropzone(dropzone, fileInput, infoElement, onFileChanged) {
    if (!dropzone || !fileInput) return;
    
    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        infoElement.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
        infoElement.style.display = "block";
      } else {
        infoElement.textContent = "";
        infoElement.style.display = "none";
      }
      if (onFileChanged) onFileChanged();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change'));
      }
    });
  }

  setupDropzone(advertDropzone, advertImage, advertFileInfo, () => {
    if (previewPhotoBlobUrl) {
      URL.revokeObjectURL(previewPhotoBlobUrl);
      previewPhotoBlobUrl = null;
    }
    updateLivePreview();
  });

  setupDropzone(accessoryDropzone, accessoryImage, accessoryFileInfo);

  // Live preview input events
  [advertTag, advertTitle, advertBody, advertButtonLabel, advertButtonUrl].forEach((elem) => {
    elem.addEventListener("input", updateLivePreview);
  });

  // Copy button helper with icon state transition
  function setupCopyButton(btn, targetElementId, successToast) {
    if (!btn) return;
    const targetElem = document.getElementById(targetElementId);
    if (!targetElem) return;
    const copySvg = btn.querySelector(".copy-svg");
    const checkSvg = btn.querySelector(".check-svg");
    const label = btn.querySelector(".copy-label");
    const originalLabel = label ? label.textContent : "";

    btn.addEventListener("click", async () => {
      const textToCopy = targetElem.textContent;
      try {
        await navigator.clipboard.writeText(textToCopy);
        btn.classList.add("copied");
        if (copySvg) copySvg.hidden = true;
        if (checkSvg) checkSvg.hidden = false;
        if (label) label.textContent = "Copied!";
        showToast(successToast, "success");
        setTimeout(() => {
          btn.classList.remove("copied");
          if (copySvg) copySvg.hidden = false;
          if (checkSvg) checkSvg.hidden = true;
          if (label) label.textContent = originalLabel;
        }, 2200);
      } catch (_) {
        showToast("Could not access clipboard. Please copy manually.", "error");
      }
    });
  }

  setupCopyButton(copySqlBtn, "sql-code-display", "Supabase SQL script copied to clipboard!");
  setupCopyButton(copyEnvBtn, "env-code-display", ".env configuration template copied to clipboard!");

  function invEsc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function renderInventory(items, target) {
    var searchEl = document.getElementById("inv-search");
    var catSel = document.getElementById("inv-cat");
    var q = searchEl ? searchEl.value.trim().toLowerCase() : "";
    var cat = catSel ? catSel.value : "";
    if (catSel) {
      var cats = Array.from(new Set(items.map(function (i) { return i.category; }).filter(Boolean))).sort();
      catSel.innerHTML = '<option value="">All categories</option>' + cats.map(function (c) { return '<option value="' + invEsc(c) + '">' + invEsc(c) + '</option>'; }).join("");
      catSel.value = cats.indexOf(cat) >= 0 ? cat : "";
      cat = catSel.value;
    }
    var shown = items.filter(function (i) {
      if (cat && i.category !== cat) return false;
      if (!q) return true;
      return ((i.name || "") + " " + (i.category || "") + " " + (i.description || "")).toLowerCase().indexOf(q) >= 0;
    });
    var count = document.getElementById("inv-count");
    if (count) count.textContent = shown.length + " of " + items.length + " items";
    if (!shown.length) { target.innerHTML = '<div class="inv-empty">No items found.</div>'; return; }
    var rows = shown.map(function (i) {
      var cur = i.currency || "USD";
      var price = (i.price === null || i.price === "" || i.price === undefined) ? "-" : cur + " " + Number(i.price).toFixed(2);
      var old = (i.old_price !== null && i.old_price !== undefined && i.old_price !== "") ? '<span class="inv-old">' + invEsc(cur + " " + Number(i.old_price).toFixed(2)) + '</span>' : "-";
      var rating = (i.rating !== null && i.rating !== undefined && i.rating !== "") ? "&#9733; " + Number(i.rating).toFixed(1) : "-";
      var reviews = (i.reviews !== null && i.reviews !== undefined && i.reviews !== "") ? invEsc(i.reviews) : "-";
      var photo = i.image_url ? '<img src="' + invEsc(i.image_url) + '" alt="" loading="lazy">' : "";
      var tag = '<span class="status-tag ' + (i.is_active ? "active" : "inactive") + '">' + (i.is_active ? "In Stock" : "Hidden") + '</span>';
      var id = invEsc(i.id);
      return '<tr><td>' + photo + '</td><td class="inv-name">' + invEsc(i.name) + '</td><td>' + invEsc(i.category) + '</td><td>' + invEsc(price) + '</td><td>' + old + '</td><td>' + rating + '</td><td>' + reviews + '</td>'
        + '<td><div class="inv-acts">' + tag + '<button type="button" class="btn btn-secondary btn-sm" data-kind="accessory" data-action="edit" data-id="' + id + '">Edit</button><button type="button" class="btn btn-danger btn-sm" data-kind="accessory" data-action="delete" data-id="' + id + '">Delete</button></div></td></tr>';
    }).join("");
    target.innerHTML = '<div class="inv-scroll"><table class="inv-table"><thead><tr><th>Photo</th><th>Name</th><th>Category</th><th>Price</th><th>Old price</th><th>Rating</th><th>Reviews</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  // Render Table Rows
  function renderRows(items, target, kind) {
    if (kind === "accessory") { renderInventory(items, target); return; }
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "data-empty";
      empty.textContent = kind === "advert" 
        ? "No adverts published yet. Fill in the form above to post your first update." 
        : "No sale items yet. Add accessories or parts using the form above.";
      target.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const row = document.createElement("article");
      row.className = "data-row";

      // Thumbnail
      if (item.image_url) {
        const image = document.createElement("img");
        image.className = "data-thumb";
        image.src = item.image_url;
        image.alt = item.title || item.name || "";
        image.loading = "lazy";
        row.appendChild(image);
      } else {
        const blank = document.createElement("div");
        blank.className = "data-thumb-empty";
        blank.textContent = "No photo";
        row.appendChild(blank);
      }

      // Details
      const details = document.createElement("div");
      details.className = "data-info";

      const titleRow = document.createElement("div");
      titleRow.className = "data-name-line";

      const title = document.createElement("h4");
      title.className = "data-name";
      title.textContent = item.title || item.name || "Item";

      const badge = document.createElement("span");
      badge.className = "status-tag " + (kind === "advert" 
        ? (item.published ? "published" : "draft") 
        : (item.is_active ? "active" : "inactive"));
      badge.textContent = kind === "advert"
        ? (item.published ? "Published" : "Draft")
        : (item.is_active ? "In Stock" : "Hidden");

      titleRow.append(title, badge);

      const meta = document.createElement("p");
      meta.className = "data-meta";
      if (kind === "advert") {
        meta.textContent = `${item.tag || "What's new"} · ${new Date(item.created_at).toLocaleDateString()}`;
      } else {
        const price = item.price === null || item.price === "" 
          ? "Price on request" 
          : `${item.currency || "USD"} ${Number(item.price).toFixed(2)}`;
        meta.textContent = `${item.category || "General"} · ${price}`;
      }

      details.append(titleRow, meta);
      row.appendChild(details);

      // Actions
      const actions = document.createElement("div");
      actions.className = "data-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-secondary btn-sm";
      editBtn.textContent = "Edit";
      editBtn.dataset.kind = kind;
      editBtn.dataset.action = "edit";
      editBtn.dataset.id = item.id;

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-danger btn-sm";
      deleteBtn.textContent = "Delete";
      deleteBtn.dataset.kind = kind;
      deleteBtn.dataset.action = "delete";
      deleteBtn.dataset.id = item.id;

      actions.append(editBtn, deleteBtn);
      row.appendChild(actions);

      fragment.appendChild(row);
    });

    target.replaceChildren(fragment);
  }

  // Load Data
  async function loadData() {
    try {
      const [advs, accs] = await Promise.all([
        api("/api/admin/adverts"),
        api("/api/admin/accessories")
      ]);
      adverts = Array.isArray(advs) ? advs : [];
      accessories = Array.isArray(accs) ? accs : [];
      advertsCountBadge.textContent = String(adverts.length);
      accessoriesCountBadge.textContent = String(accessories.length);
      renderRows(adverts, postList, "advert");
      renderRows(accessories, accessoryList, "accessory");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Check Supabase / SQLite System Status
  async function checkSystemStatus() {
    try {
      const status = await api("/api/admin/system-status");
      if (status.database === "supabase") {
        dbDot.className = "db-dot active";
        dbStatusText.textContent = "Supabase Connected";
        if (supabaseStatusDetail) {
          supabaseStatusDetail.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; color:var(--supabase); margin-bottom:6px">
              <span style="font-weight:600">● Connected to Supabase PostgreSQL &amp; Cloud Storage</span>
            </div>
            <div><strong>Endpoint:</strong> <code>${status.supabaseUrl || 'Configured'}</code></div>
            <div><strong>Storage Bucket:</strong> <code>${status.supabaseBucket}</code></div>
          `;
        }
      } else {
        dbDot.className = "db-dot";
        dbStatusText.textContent = "Local SQLite Mode";
        if (supabaseStatusDetail) {
          supabaseStatusDetail.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; color:var(--text-muted); margin-bottom:6px">
              <span style="font-weight:600">● Running in Local SQLite &amp; Local Storage Mode</span>
            </div>
          `;
        }
      }
    } catch (_) {
      dbStatusText.textContent = "Server Online";
    }
  }

  // Extract Form Data
  function getAdvertFormData() {
    const data = new FormData();
    data.append("tag", advertTag.value.trim() || "What's new");
    data.append("title", advertTitle.value.trim());
    data.append("body", advertBody.value.trim());
    data.append("buttonLabel", advertButtonLabel.value.trim());
    data.append("buttonUrl", advertButtonUrl.value.trim());
    data.append("published", String(advertPublished.checked));
    if (advertImage.files && advertImage.files[0]) {
      data.append("image", advertImage.files[0]);
    }
    return data;
  }

  function getAccessoryFormData() {
    const data = new FormData();
    data.append("name", document.getElementById("accessory-name").value.trim());
    data.append("category", document.getElementById("accessory-category").value);
    data.append("description", document.getElementById("accessory-description").value.trim());
    data.append("price", document.getElementById("accessory-price").value);
    data.append("currency", document.getElementById("accessory-currency").value.trim() || "USD");
  data.append("oldPrice", document.getElementById("accessory-old-price").value);
  data.append("rating", document.getElementById("accessory-rating").value);
  data.append("reviews", document.getElementById("accessory-reviews").value);
    data.append("sortOrder", document.getElementById("accessory-sort-order").value || "0");
    data.append("isActive", String(document.getElementById("accessory-active").checked));
    if (accessoryImage.files && accessoryImage.files[0]) {
      data.append("image", accessoryImage.files[0]);
    }
    return data;
  }

  function resetAdvert() {
    editingAdvert = null;
    advertForm.reset();
    advertTag.value = "What's new";
    advertPublished.checked = true;
    advertFileInfo.style.display = "none";
    advertFileInfo.textContent = "";
    document.getElementById("editor-title").textContent = "Create an advert";
    setButtonState(saveAdvert, false, "Publishing…", "Publish update");
    cancelEdit.hidden = true;
    if (previewPhotoBlobUrl) {
      URL.revokeObjectURL(previewPhotoBlobUrl);
      previewPhotoBlobUrl = null;
    }
    updateLivePreview();
  }

  function resetAccessory() {
    var invM = document.getElementById("inv-modal"); if (invM) invM.classList.remove("inv-open");
    editingAccessory = null;
    accessoryForm.reset();
    document.getElementById("accessory-currency").value = "USD";
  document.getElementById("accessory-old-price").value = ""; document.getElementById("accessory-rating").value = ""; document.getElementById("accessory-reviews").value = "";
    document.getElementById("accessory-sort-order").value = "0";
    document.getElementById("accessory-active").checked = true;
    accessoryFileInfo.style.display = "none";
    accessoryFileInfo.textContent = "";
    document.getElementById("accessory-editor-title").textContent = "Add an item for sale";
    setButtonState(saveAccessory, false, "Saving…", "Save item");
    cancelAccessoryEdit.hidden = true;
  }

  // Login handler
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setButtonState(loginSubmitBtn, true, "Signing In…", "Sign In");
    try {
      await api("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: document.getElementById("login-username").value.trim(),
          password: document.getElementById("login-password").value
        })
      });
      setSignedIn(true);
      await loadData();
      await checkSystemStatus();
      showToast("Signed in successfully.", "success");
    } catch (error) {
      setSignedIn(false);
      showToast(error.message, "error");
    } finally {
      setButtonState(loginSubmitBtn, false, "Signing In…", "Sign In");
    }
  });

  // Advert submit handler (with loader feedback)
  advertForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const isEdit = Boolean(editingAdvert);
    setButtonState(saveAdvert, true, isEdit ? "Updating advert…" : "Publishing advert…", isEdit ? "Save changes" : "Publish update");
    try {
      const url = isEdit ? `/api/admin/adverts/${encodeURIComponent(editingAdvert.id)}` : "/api/admin/adverts";
      await api(url, {
        method: isEdit ? "PUT" : "POST",
        body: getAdvertFormData()
      });
      resetAdvert();
      await loadData();
      showToast(isEdit ? "Advert updated in Supabase." : "Update published to Supabase.", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonState(saveAdvert, false, isEdit ? "Updating advert…" : "Publishing advert…", isEdit ? "Save changes" : "Publish update");
    }
  });

  // Accessory submit handler (with loader feedback)
  accessoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const isEdit = Boolean(editingAccessory);
    setButtonState(saveAccessory, true, isEdit ? "Updating item…" : "Saving item…", isEdit ? "Save changes" : "Save item");
    try {
      if (!isEdit && (!accessoryImage.files || !accessoryImage.files[0])) {
        throw new Error("Choose a photo for this item.");
      }
      const url = isEdit ? `/api/admin/accessories/${encodeURIComponent(editingAccessory.id)}` : "/api/admin/accessories";
      await api(url, {
        method: isEdit ? "PUT" : "POST",
        body: getAccessoryFormData()
      });
      resetAccessory();
      await loadData();
      showToast(isEdit ? "Item updated in Supabase." : "Item added to Supabase.", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonState(saveAccessory, false, isEdit ? "Updating item…" : "Saving item…", isEdit ? "Save changes" : "Save item");
    }
  });

  // Edit Handlers
  function editAdvert(item) {
    editingAdvert = item;
    advertTag.value = item.tag || "What's new";
    advertTitle.value = item.title || "";
    advertBody.value = item.body || "";
    advertButtonLabel.value = item.button_label || "";
    advertButtonUrl.value = item.button_url || "";
    advertPublished.checked = Boolean(item.published);
    advertImage.value = "";
    if (item.image_url) {
      advertFileInfo.textContent = "Current image will be kept unless replaced.";
      advertFileInfo.style.display = "block";
    } else {
      advertFileInfo.style.display = "none";
    }
    document.getElementById("editor-title").textContent = "Edit Advert";
    setButtonState(saveAdvert, false, "Saving…", "Save changes");
    cancelEdit.hidden = false;

    switchTab("tab-adverts");
    updateLivePreview();
  }

  function editAccessory(item) {
    editingAccessory = item;
    document.getElementById("accessory-name").value = item.name || "";
    const categorySelect = document.getElementById("accessory-category");
    if (item.category && !Array.from(categorySelect.options).some(o => o.value === item.category)) {
      const opt = document.createElement("option");
      opt.value = item.category;
      opt.textContent = item.category;
      categorySelect.appendChild(opt);
    }
    categorySelect.value = item.category || "Other";
    document.getElementById("accessory-description").value = item.description || "";
    document.getElementById("accessory-price").value = item.price ?? "";
    document.getElementById("accessory-currency").value = item.currency || "USD";
  document.getElementById("accessory-old-price").value = item.old_price ?? ""; document.getElementById("accessory-rating").value = item.rating ?? ""; document.getElementById("accessory-reviews").value = item.reviews ?? "";
    document.getElementById("accessory-sort-order").value = item.sort_order ?? 0;
    document.getElementById("accessory-active").checked = Boolean(item.is_active);
    accessoryImage.value = "";
    if (item.image_url) {
      accessoryFileInfo.textContent = "Current photo will be kept unless replaced.";
      accessoryFileInfo.style.display = "block";
    } else {
      accessoryFileInfo.style.display = "none";
    }
    document.getElementById("accessory-editor-title").textContent = "Edit Item";
    setButtonState(saveAccessory, false, "Saving…", "Save changes");
    cancelAccessoryEdit.hidden = false;

    switchTab("tab-accessories");
  }

  cancelEdit.addEventListener("click", resetAdvert);
  cancelAccessoryEdit.addEventListener("click", resetAccessory);

  // Sign out handler
  signOutBtn.addEventListener("click", async () => {
    try { await api("/api/admin/logout", { method: "POST" }); } catch (_) {}
    setSignedIn(false);
    resetAdvert();
    resetAccessory();
    showToast("Signed out of Studio.");
  });

  // Table action delegation (Edit & Delete)
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-kind]");
    if (!button) return;
    const kind = button.dataset.kind;
    const action = button.dataset.action;
    const id = button.dataset.id;
    const list = kind === "advert" ? adverts : accessories;
    const item = list.find(entry => entry.id === id);
    if (!item) return;

    if (action === "edit") {
      if (kind === "advert") editAdvert(item);
      else editAccessory(item);
      return;
    }

    if (action === "delete") {
      const title = item.title || item.name || "this item";
      if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
      button.disabled = true;
      try {
        const resource = kind === "advert" ? "adverts" : "accessories";
        await api(`/api/admin/${resource}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
        await loadData();
        showToast(kind === "advert" ? "Advert deleted." : "Item removed.", "success");
      } catch (error) {
        button.disabled = false;
        showToast(error.message, "error");
      }
    }
  });

  // Inventory top bar + pop-up form
  (function () {
    var m = document.getElementById("inv-modal");
    function $(id) { return document.getElementById(id); }
    $("inv-search").addEventListener("input", function () { renderInventory(accessories, accessoryList); });
    $("inv-cat").addEventListener("change", function () { renderInventory(accessories, accessoryList); });
    $("inv-refresh").addEventListener("click", function () { loadData(); });
    $("inv-add").addEventListener("click", function () { resetAccessory(); m.classList.add("inv-open"); });
    $("inv-close").addEventListener("click", function () { resetAccessory(); });
    m.addEventListener("click", function (e) { if (e.target === m) resetAccessory(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && m.classList.contains("inv-open")) resetAccessory(); });
    document.addEventListener("click", function (e) {
      var b = e.target.closest('button[data-kind="accessory"][data-action="edit"]');
      if (b) m.classList.add("inv-open");
    });
  })();

  // Initialization
  async function initialize() {
    updateLivePreview();
    checkSystemStatus();
    try {
      const state = await api("/api/admin/session");
      if (state.authenticated) {
        setSignedIn(true);
        await loadData();
      } else {
        setSignedIn(false);
      }
    } catch (_) {
      setSignedIn(false);
    }
  }

  initialize();
})();
