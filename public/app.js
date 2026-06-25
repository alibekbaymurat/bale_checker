(function () {
  const path = window.location.pathname;

  const fields = [
    "mowing_date",
    "baling_date",
    "moisture_min_percent",
    "moisture_max_percent",
    "cut_number_this_year",
    "cut_number_total",
    "crop_type",
    "field_name",
    "bales_count",
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
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.errors ? data.errors.join("\n") : data.error || "Ошибка запроса.";
      throw new Error(message);
    }
    return data;
  }

  function groupDetails(group) {
    return [
      ["Поле", group.field_name],
      ["Культура", group.crop_type],
      ["Дата покоса", formatDate(group.mowing_date)],
      ["Дата зарулонивания", formatDate(group.baling_date)],
      ["Влажность", `${group.moisture_min_percent}-${group.moisture_max_percent}%`],
      ["Укос за год", group.cut_number_this_year],
      ["Укос за весь период", group.cut_number_total],
      ["Количество тюков", group.bales_count],
    ];
  }

  function renderQr(container, group) {
    const url = publicUrl(group.id);
    const path = publicPath(group.id);
    container.innerHTML = `
      <div class="qr-box print-area">
        <div id="qr-${group.id}" class="qr-code"></div>
        <div>
          <h2>QR для ${group.id}</h2>
          <p><a class="qr-link" href="${path}">${path}</a></p>
          <div class="qr-actions">
            <button class="button small" type="button" data-download-qr="${group.id}">Скачать QR</button>
            <button class="button secondary small" type="button" data-print-qr>Печать QR</button>
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
    $("#admin-list").classList.remove("hidden");
    setStatus("Загрузка групп...");
    try {
      const { groups } = await api("/api/groups");
      const list = $("#groups-list");
      if (groups.length === 0) {
        list.innerHTML = '<div class="status">Групп пока нет.</div>';
      } else {
        list.innerHTML = groups.map((group) => {
          const path = publicPath(group.id);
          return `
            <article class="group-card">
              <div>
                <h2>${escapeHtml(group.id)}</h2>
                <a class="qr-link" href="${path}">${escapeHtml(path)}</a>
                <div class="meta">
                  <div><span>Поле</span>${escapeHtml(group.field_name)}</div>
                  <div><span>Культура</span>${escapeHtml(group.crop_type)}</div>
                  <div><span>Тюки</span>${escapeHtml(group.bales_count)}</div>
                  <div><span>Покос</span>${escapeHtml(formatDate(group.mowing_date))}</div>
                  <div><span>Зарулонивание</span>${escapeHtml(formatDate(group.baling_date))}</div>
                  <div><span>Влажность</span>${escapeHtml(group.moisture_min_percent)}-${escapeHtml(group.moisture_max_percent)}%</div>
                </div>
                <div id="qr-panel-${group.id}" class="qr-panel"></div>
              </div>
              <div class="card-actions">
                <a class="button secondary small" href="/group/${encodeURIComponent(group.id)}">Публичная</a>
                <a class="button secondary small" href="/admin/edit/${encodeURIComponent(group.id)}">Редактировать</a>
                <button class="button danger small" type="button" data-delete="${group.id}">Удалить</button>
              </div>
            </article>
          `;
        }).join("");

        for (const group of groups) {
          renderQr($(`#qr-panel-${CSS.escape(group.id)}`), group);
        }
      }
      setStatus("");
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  function bindDeletes() {
    $("#groups-list").addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete]");
      if (!button) return;
      const id = button.dataset.delete;
      if (!confirm(`Удалить группу ${id}?`)) return;

      button.disabled = true;
      try {
        await api(`/api/groups/${encodeURIComponent(id)}`, { method: "DELETE" });
        await loadAdminList();
      } catch (error) {
        setStatus(error.message, true);
        button.disabled = false;
      }
    });
  }

  async function loadForm() {
    $("#admin-form").classList.remove("hidden");
    const form = $("#group-form");
    const result = $("#created-result");
    const errors = $("#form-errors");
    const isEdit = path.startsWith("/admin/edit/");
    const id = isEdit ? decodeURIComponent(path.split("/").pop()) : null;

    if (isEdit) {
      $("#form-title").textContent = `Редактирование ${id}`;
      setStatus("Загрузка группы...");
      try {
        const { group } = await api(`/api/groups/${encodeURIComponent(id)}`);
        fillForm(form, group);
        setStatus("");
      } catch (error) {
        setStatus(error.message, true);
      }
    }

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

  async function loadPublicGroup() {
    const id = decodeURIComponent(path.split("/").pop() || "");
    setStatus("Загрузка группы...");
    try {
      const { group } = await api(`/api/groups/${encodeURIComponent(id)}`);
      const card = $("#public-group");
      card.innerHTML = `
        <h1>Группа тюков: ${escapeHtml(group.id)}</h1>
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
    bindQrActions(document);
    bindDeletes();
    loadAdminList();
  } else if (path === "/admin/new" || path.startsWith("/admin/edit/")) {
    bindQrActions(document);
    loadForm();
  } else if (path.startsWith("/group/")) {
    loadPublicGroup();
  }
})();
