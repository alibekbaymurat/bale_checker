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

function generateGroupId() {
  const year = new Date().getUTCFullYear();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `BG-${year}-${code}`;
}

async function createUniqueId(db) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = generateGroupId();
    const existing = await db.prepare("SELECT id FROM bale_groups WHERE id = ?").bind(id).first();
    if (!existing) return id;
  }
  throw new Error("Не удалось сгенерировать уникальный ID.");
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT id, mowing_date, baling_date, moisture_min_percent, moisture_max_percent,
            cut_number_this_year, cut_number_total, crop_type, field_name, bales_count,
            created_at, updated_at
       FROM bale_groups
      ORDER BY baling_date DESC, created_at DESC`
  ).all();

  return json({ groups: results || [] });
}

export async function onRequestPost({ request, env }) {
  const input = await readJson(request);
  const errors = validatePayload(input);
  if (errors.length > 0) {
    return json({ errors }, 400);
  }

  const data = normalizePayload(input);
  const id = await createUniqueId(env.DB);

  await env.DB.prepare(
    `INSERT INTO bale_groups (
       id, mowing_date, baling_date, moisture_min_percent, moisture_max_percent,
       cut_number_this_year, cut_number_total, crop_type, field_name, bales_count
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      data.mowing_date,
      data.baling_date,
      data.moisture_min_percent,
      data.moisture_max_percent,
      data.cut_number_this_year,
      data.cut_number_total,
      data.crop_type,
      data.field_name,
      data.bales_count
    )
    .run();

  const group = await env.DB.prepare("SELECT * FROM bale_groups WHERE id = ?").bind(id).first();
  return json({ group }, 201);
}
