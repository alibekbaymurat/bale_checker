const REQUIRED_FIELDS = [
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

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function normalizePayload(input) {
  return {
    mowing_date: String(input.mowing_date || "").trim(),
    baling_date: String(input.baling_date || "").trim(),
    moisture_min_percent: Number(input.moisture_min_percent),
    moisture_max_percent: Number(input.moisture_max_percent),
    cut_number_this_year: Number.parseInt(input.cut_number_this_year, 10),
    cut_number_total: Number.parseInt(input.cut_number_total, 10),
    crop_type: String(input.crop_type || "").trim(),
    field_name: String(input.field_name || "").trim(),
    bales_count: Number.parseInt(input.bales_count, 10),
  };
}

function validatePayload(input) {
  if (!input || typeof input !== "object") {
    return ["Неверный JSON-запрос."];
  }

  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (!hasValue(input[field])) {
      errors.push(`Поле ${field} обязательно.`);
    }
  }

  const data = normalizePayload(input);

  if (!Number.isFinite(data.moisture_min_percent)) {
    errors.push("Минимальная влажность должна быть числом.");
  }
  if (!Number.isFinite(data.moisture_max_percent)) {
    errors.push("Максимальная влажность должна быть числом.");
  }
  if (
    Number.isFinite(data.moisture_min_percent) &&
    Number.isFinite(data.moisture_max_percent) &&
    data.moisture_min_percent > data.moisture_max_percent
  ) {
    errors.push("Минимальная влажность не может быть больше максимальной.");
  }
  if (!Number.isInteger(data.bales_count) || data.bales_count <= 0) {
    errors.push("Количество тюков должно быть больше 0.");
  }
  if (!Number.isInteger(data.cut_number_this_year) || data.cut_number_this_year <= 0) {
    errors.push("Укос за год должен быть больше 0.");
  }
  if (!Number.isInteger(data.cut_number_total) || data.cut_number_total <= 0) {
    errors.push("Укос за весь период должен быть больше 0.");
  }

  return errors;
}

function getId(params) {
  return String(params.id || "").trim();
}

export async function onRequestGet({ env, params }) {
  const id = getId(params);
  const group = await env.DB.prepare("SELECT * FROM bale_groups WHERE id = ?").bind(id).first();
  if (!group) {
    return json({ error: "Группа не найдена." }, 404);
  }
  return json({ group });
}

export async function onRequestPut({ request, env, params }) {
  const id = getId(params);
  const input = await readJson(request);
  const errors = validatePayload(input);
  if (errors.length > 0) {
    return json({ errors }, 400);
  }

  const existing = await env.DB.prepare("SELECT id FROM bale_groups WHERE id = ?").bind(id).first();
  if (!existing) {
    return json({ error: "Группа не найдена." }, 404);
  }

  const data = normalizePayload(input);
  await env.DB.prepare(
    `UPDATE bale_groups
        SET mowing_date = ?,
            baling_date = ?,
            moisture_min_percent = ?,
            moisture_max_percent = ?,
            cut_number_this_year = ?,
            cut_number_total = ?,
            crop_type = ?,
            field_name = ?,
            bales_count = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
  )
    .bind(
      data.mowing_date,
      data.baling_date,
      data.moisture_min_percent,
      data.moisture_max_percent,
      data.cut_number_this_year,
      data.cut_number_total,
      data.crop_type,
      data.field_name,
      data.bales_count,
      id
    )
    .run();

  const group = await env.DB.prepare("SELECT * FROM bale_groups WHERE id = ?").bind(id).first();
  return json({ group });
}

export async function onRequestDelete({ env, params }) {
  const id = getId(params);
  const existing = await env.DB.prepare("SELECT id FROM bale_groups WHERE id = ?").bind(id).first();
  if (!existing) {
    return json({ error: "Группа не найдена." }, 404);
  }

  await env.DB.prepare("DELETE FROM bale_groups WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
