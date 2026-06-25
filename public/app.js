(function () {
  const path = window.location.pathname;
  let currentUser = null;
  let listPage = 1;
  const pageSize = 50;

  const fields = [
    "group_name",
    "mowing_date",
    "baling_date",
    "moisture_min_percent",
    "moisture_max_percent",
    "cut_number_this_year",
    "cut_number_total",
    "crop_type",
    "field_name",
    "bales_count",
    "notes",
  ];

  function $(selector) {
    return document.querySelector(selector);
  }

  function setStatus(message, isError) {
    const status = $("#status");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("error", Boolean(isError));
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ru-RU");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function publicUrl(id) {
    return `${window.location.origin}/group/${encodeURIComponent(id)}`;
  }

  function publicPath(id) {
    return `/group/${encodeURIComponent(id)}`;
  }

  async function api(pathname, options) {
    const response = await fetch(pathname, {
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      ...options,
    });
    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }
    if (!response.ok) {
      const message = data.errors
        ? data.errors.join("\n")
        : data.error || `Ошибка запроса: HTTP ${response.status}`;
      throw new Error(message);
    }
    return data;
  }

  function hideViews() {
    document.querySelectorAll(".view").forEach((view) => view.classList.add("hidden"));
  }

  async function loadSession() {
    const data = await api("/api/auth/me");
    currentUser = data.user;
    renderUserbar();
  }

  function isAdmin() {
    return currentUser && currentUser.role === "admin";
  }

  function renderUserbar() {
    const userbar = $("#userbar");
    if (!userbar) return;

    if (!currentUser) {
      userbar.classList.add("hidden");
      userbar.innerHTML = "";
      return;
    }

    userbar.classList.remove("hidden");
    userbar.innerHTML = `
      <button class="profile-button" type="button" data-profile-toggle aria-label="Профиль">
        <img class="profile-icon" src="/person.svg" alt="">
      </button>
      <div class="profile-menu hidden" data-profile-menu>
        <div class="profile-name">${escapeHtml(currentUser.username)}</div>
        <div class="profile-role">${escapeHtml(currentUser.role)}</div>
        <button class="button secondary small" type="button" data-logout>Выйти</button>
      </div>
    `;
  }

  function bindUserbar() {
    const userbar = $("#userbar");
    if (!userbar) return;

    userbar.addEventListener("click", async (event) => {
      if (event.target.closest("[data-profile-toggle]")) {
        const menu = userbar.querySelector("[data-profile-menu]");
        menu.classList.toggle("hidden");
        return;
      }

      if (!event.target.closest("[data-logout]")) return;
      await api("/api/auth/logout", { method: "POST" });
      currentUser = null;
      renderUserbar();
      showLogin();
    });

    document.addEventListener("click", (event) => {
      if (userbar.contains(event.target)) return;
      userbar.querySelector("[data-profile-menu]")?.classList.add("hidden");
    });
  }

  function showLogin(message) {
    hideViews();
    const loginView = $("#login-view");
    const loginForm = $("#login-form");
    const loginErrors = $("#login-errors");
    loginView.classList.remove("hidden");
    loginErrors.textContent = message || "";

    if (loginForm.dataset.bound === "true") return;
    loginForm.dataset.bound = "true";
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      loginErrors.textContent = "";
      const formData = new FormData(loginForm);

      try {
        const data = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            username: formData.get("username"),
            password: formData.get("password"),
          }),
        });
        currentUser = data.user;
        loginForm.reset();
        renderUserbar();
        await loadAdminRoute();
      } catch (error) {
        loginErrors.textContent = error.message;
      }
    });
  }

  function groupDetails(group) {
    return [
      ["Название группы", group.group_name],
      ["ID", group.id],
      ["Поле", group.field_name],
      ["Культура", group.crop_type],
      ["Дата покоса", formatDate(group.mowing_date)],
      ["Дата зарулонивания", formatDate(group.baling_date)],
      ["Влажность", `${group.moisture_min_percent}-${group.moisture_max_percent}%`],
      ["Укос за год", group.cut_number_this_year],
      ["Укос за весь период", group.cut_number_total],
      ["Количество тюков", group.bales_count],
      ["Примечание", group.notes || "-"],
    ];
  }

  function groupYear(group) {
    return String(group.baling_date || group.mowing_date || "").slice(0, 4) || "----";
  }

  function renderQr(container, group) {
    const url = publicUrl(group.id);
    container.innerHTML = `
      <div class="qr-box print-area">
        <div id="qr-${group.id}" class="qr-code"></div>
        <div>
          <h2>QR для ${group.id}</h2>
          <div class="qr-actions">
            <button class="button small" type="button" data-download-qr="${group.id}">Скачать QR</button>
          </div>
        </div>
      </div>
    `;

    const qrNode = container.querySelector(`#qr-${CSS.escape(group.id)}`);
    new QRCode(qrNode, {
      text: url,
      width: 160,
      height: 160,
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  function renderDetailCard(container, group) {
    container.innerHTML = `
      <h1>${escapeHtml(group.group_name || group.id)}</h1>
      <div class="detail-grid">
        ${groupDetails(group).map(([label, value]) => `
          <div class="detail-row ${label === "Примечание" ? "wide-field" : ""}">
            <span>${escapeHtml(label)}</span>${escapeHtml(value)}
          </div>
        `).join("")}
      </div>
      <div id="detail-qr-panel" class="qr-panel"></div>
      <div class="card-actions">
        ${isAdmin() ? `
          <a class="button secondary small" href="/admin/edit/${encodeURIComponent(group.id)}">Редактировать</a>
          <button class="button danger small" type="button" data-delete="${escapeHtml(group.id)}">Удалить</button>
        ` : ""}
      </div>
    `;
    renderQr($("#detail-qr-panel"), group);
  }

  function renderPagination(totalItems) {
    const pagination = $("#pagination");
    if (!pagination) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (totalPages === 1) {
      pagination.innerHTML = "";
      return;
    }

    pagination.innerHTML = `
      <button class="button secondary small" type="button" data-page="${listPage - 1}" ${listPage === 1 ? "disabled" : ""}>Назад</button>
      <span>Страница ${listPage} из ${totalPages}</span>
      <button class="button secondary small" type="button" data-page="${listPage + 1}" ${listPage === totalPages ? "disabled" : ""}>Вперед</button>
    `;
  }

  function bindQrActions(root) {
    root.addEventListener("click", (event) => {
      const downloadButton = event.target.closest("[data-download-qr]");
      if (downloadButton) {
        const panel = downloadButton.closest(".qr-box");
        const image = panel.querySelector("img") || panel.querySelector("canvas");
        const id = downloadButton.dataset.downloadQr;
        const link = document.createElement("a");
        link.download = `${id}-qr.png`;
        link.href = image.tagName.toLowerCase() === "canvas" ? image.toDataURL("image/png") : image.src;
        link.click();
      }

      if (event.target.closest("[data-print-qr]")) {
        document.querySelectorAll(".print-area.is-printing").forEach((node) => {
          node.classList.remove("is-printing");
        });
        event.target.closest(".print-area").classList.add("is-printing");
        window.print();
      }
    });
  }

  function collectForm(form) {
    const formData = new FormData(form);
    return Object.fromEntries(fields.map((field) => [field, formData.get(field)]));
  }

  function fillForm(form, group) {
    for (const field of fields) {
      form.elements[field].value = group[field] ?? "";
    }
  }

  async function loadAdminList() {
    hideViews();
    $("#admin-list").classList.remove("hidden");
    $("#create-group-link").classList.toggle("hidden", !isAdmin());
    setStatus("Загрузка групп...");
    try {
      const { groups } = await api("/api/groups");
      const list = $("#groups-list");
      if (groups.length === 0) {
        list.innerHTML = '<div class="status">Групп пока нет.</div>';
        renderPagination(0);
      } else {
        const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
        listPage = Math.min(listPage, totalPages);
        const start = (listPage - 1) * pageSize;
        const pageGroups = groups.slice(start, start + pageSize);

        list.innerHTML = pageGroups.map((group, index) => {
          const number = start + index + 1;
          return `
            <a class="group-card compact" href="/admin/group/${encodeURIComponent(group.id)}">
              <div class="group-name-line">
                <span class="group-number">${number}</span>
                <h2>${escapeHtml(group.group_name || group.id)}</h2>
              </div>
              <div class="group-summary">
                <span>
                  <span>Год</span>
                  ${escapeHtml(groupYear(group))}
                </span>
                <span>
                  <span>Культура</span>
                  ${escapeHtml(group.crop_type)}
                </span>
                <span>
                  <span>Поле</span>
                  ${escapeHtml(group.field_name)}
                </span>
                <span>
                  <span>Укос за год</span>
                  ${escapeHtml(group.cut_number_this_year)}
                </span>
              </div>
            </a>
          `;
        }).join("");
        renderPagination(groups.length);
      }
      setStatus("");
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  function bindAdminActions() {
    if (document.body.dataset.adminActionsBound === "true") return;
    document.body.dataset.adminActionsBound = "true";

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete]");
      if (!button) return;
      event.preventDefault();

      const id = button.dataset.delete;
      if (!confirm(`Удалить группу ${id}?`)) return;

      button.disabled = true;
      try {
        await api(`/api/groups/${encodeURIComponent(id)}`, { method: "DELETE" });
        window.location.href = "/admin";
      } catch (error) {
        setStatus(error.message, true);
        button.disabled = false;
      }
    });

    $("#pagination")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-page]");
      if (!button || button.disabled) return;
      listPage = Number.parseInt(button.dataset.page, 10);
      await loadAdminList();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  async function loadAdminDetail() {
    hideViews();
    $("#admin-detail").classList.remove("hidden");
    const id = decodeURIComponent(path.split("/").pop() || "");
    const status = $("#detail-status");
    const detail = $("#admin-group-detail");

    status.textContent = "Загрузка группы...";
    status.classList.remove("error");
    detail.classList.add("hidden");

    try {
      const { group } = await api(`/api/groups/${encodeURIComponent(id)}`);
      $("#detail-title").textContent = group.group_name || group.id;
      renderDetailCard(detail, group);
      detail.classList.remove("hidden");
      status.textContent = "";
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    }
  }

  async function loadForm() {
    hideViews();
    $("#admin-form").classList.remove("hidden");
    const form = $("#group-form");
    const result = $("#created-result");
    const errors = $("#form-errors");
    const isEdit = path.startsWith("/admin/edit/");
    const id = isEdit ? decodeURIComponent(path.split("/").pop()) : null;

    if (!isAdmin()) {
      form.classList.add("hidden");
      result.classList.add("hidden");
      $("#form-title").textContent = "Недостаточно прав";
      setStatus("Создавать и изменять группы могут только пользователи со статусом admin.", true);
      return;
    }

    form.classList.remove("hidden");
    $("#form-title").textContent = isEdit ? `Редактирование ${id}` : "Новая группа";

    if (isEdit) {
      setStatus("Загрузка группы...");
      try {
        const { group } = await api(`/api/groups/${encodeURIComponent(id)}`);
        fillForm(form, group);
        setStatus("");
      } catch (error) {
        setStatus(error.message, true);
      }
    }

    if (form.dataset.bound === "true") return;
    form.dataset.bound = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errors.textContent = "";
      result.classList.add("hidden");
      const payload = collectForm(form);

      try {
        const { group } = await api(isEdit ? `/api/groups/${encodeURIComponent(id)}` : "/api/groups", {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
        result.classList.remove("hidden");
        renderQr(result, group);
        setStatus(isEdit ? "Группа обновлена." : "Группа создана.");
        if (!isEdit) form.reset();
      } catch (error) {
        errors.textContent = error.message;
      }
    });
  }

  async function loadAdminRoute() {
    if (!currentUser) {
      showLogin();
      return;
    }

    if (path === "/admin" || path === "/admin/") {
      loadAdminList();
    } else if (path.startsWith("/admin/group/")) {
      loadAdminDetail();
    } else if (path === "/admin/new" || path.startsWith("/admin/edit/")) {
      loadForm();
    }
  }

  async function bootAdmin() {
    bindQrActions(document);
    bindUserbar();
    bindAdminActions();

    try {
      await loadSession();
    } catch {
      currentUser = null;
      renderUserbar();
    }

    if (!currentUser) {
      showLogin();
      return;
    }

    await loadAdminRoute();
  }

  async function loadPublicGroup() {
    const id = decodeURIComponent(path.split("/").pop() || "");
    setStatus("Загрузка группы...");
    try {
      const { group } = await api(`/api/groups/${encodeURIComponent(id)}`);
      const card = $("#public-group");
      card.innerHTML = `
        <h1>${escapeHtml(group.group_name || `Группа тюков: ${group.id}`)}</h1>
        <div class="detail-grid">
          ${groupDetails(group).map(([label, value]) => `
            <div class="detail-row"><span>${escapeHtml(label)}</span>${escapeHtml(value)}</div>
          `).join("")}
        </div>
      `;
      card.classList.remove("hidden");
      setStatus("");
      document.title = `${group.id} | Bale Checker`;
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  if (path === "/admin" || path === "/admin/") {
    bootAdmin();
  } else if (path === "/admin/new" || path.startsWith("/admin/edit/")) {
    bootAdmin();
  } else if (path.startsWith("/admin/group/")) {
    bootAdmin();
  } else if (path.startsWith("/group/")) {
    loadPublicGroup();
  }
})();
