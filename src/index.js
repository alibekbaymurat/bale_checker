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

const SESSION_COOKIE = "bc_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 120000;

const USERS = {
  sagayeva_yuliana: {
    role: "user",
    passwordHash: "ba2c51faad8d54d97f49c73b8a7717c3d2638a42d537cd379e29ff4bcdee4dfe",
  },
  kassilova_irina: {
    role: "admin",
    passwordHash: "48fb0d82ed9476f6457fa958eb8fd5d274ec00e1c3246ccfa720af8afae3284f",
  },
  krakhotina_yulia: {
    role: "user",
    passwordHash: "e007db55eeeea653b6f1119ff06effee18a04204864f000b171b8c16bb00d02d",
  },
  razumovsky_dmitrii: {
    role: "user",
    passwordHash: "ea6433ba335baff5d7a28b14c8e11ef57990e946e7c6bbbd865afdf427097cf9",
  },
  emshanov_vsevolod: {
    role: "user",
    passwordHash: "87ea8a7f73c53e74988bba00e22b8f04d9d333ba5e0e3c94f5797b9b49ba04e6",
  },
  baimurat_alibek: {
    role: "admin",
    passwordHash: "7fc43f29205f0ca4fc594c90fac3e2b5364f18b4f3ed1d31ca3c62fdfa54e219",
  },
  kislyi_vladimir: {
    role: "user",
    passwordHash: "c0fcfff72be4254a7001f1c6aa7797552c09e23fde365b4763463baf9204cb7a",
  },
  akhmetshina_galiya: {
    role: "user",
    passwordHash: "287c5df69ea7610b6821064b11486376102025773f78e2880f8111e14d331286",
  },
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function jsonWithHeaders(data, headers, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
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

function base64UrlEncode(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqualHex(left, right) {
  const leftBytes = hexToBytes(left);
  const rightBytes = hexToBytes(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }
  return diff === 0;
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator === -1) return [part, ""];
        return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      })
  );
}

function sessionSecret(env) {
  return env.SESSION_SECRET || "bale-checker-dev-session-secret-change-before-production";
}

async function hmacHex(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(signature));
}

async function hashPassword(username, password) {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(`bale-checker:v1:${username}`),
      iterations: PASSWORD_ITERATIONS,
    },
    passwordKey,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

async function verifyPassword(username, password) {
  const user = USERS[username];
  if (!user) return null;

  const hash = await hashPassword(username, password);
  if (!timingSafeEqualHex(hash, user.passwordHash)) return null;
  return { username, role: user.role };
}

async function createSessionToken(user, env) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = base64UrlEncode(JSON.stringify({ username: user.username, role: user.role, expiresAt }));
  const signature = await hmacHex(payload, sessionSecret(env));
  return `${payload}.${signature}`;
}

async function readSession(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  const expectedSignature = await hmacHex(payload, sessionSecret(env));
  if (!timingSafeEqualHex(signature, expectedSignature)) return null;

  let session;
  try {
    session = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
  } catch {
    return null;
  }

  const user = USERS[session.username];
  if (!user || user.role !== session.role || session.expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return { username: session.username, role: session.role };
}

function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function expiredSessionCookie(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function publicUser(user) {
  return user ? { username: user.username, role: user.role } : null;
}

function requireUser(user) {
  if (!user) {
    return json({ error: "Нужно войти в аккаунт." }, 401);
  }
  return null;
}

function requireAdmin(user) {
  if (!user) {
    return json({ error: "Нужно войти в аккаунт." }, 401);
  }
  if (user.role !== "admin") {
    return json({ error: "Недостаточно прав." }, 403);
  }
  return null;
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

async function listGroups(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, mowing_date, baling_date, moisture_min_percent, moisture_max_percent,
            cut_number_this_year, cut_number_total, crop_type, field_name, bales_count,
            created_at, updated_at
       FROM bale_groups
      ORDER BY baling_date DESC, created_at DESC`
  ).all();

  return json({ groups: results || [] });
}

async function getGroup(env, id) {
  const group = await env.DB.prepare("SELECT * FROM bale_groups WHERE id = ?").bind(id).first();
  if (!group) {
    return json({ error: "Группа не найдена." }, 404);
  }
  return json({ group });
}

async function createGroup(request, env) {
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

async function updateGroup(request, env, id) {
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

async function deleteGroup(env, id) {
  const existing = await env.DB.prepare("SELECT id FROM bale_groups WHERE id = ?").bind(id).first();
  if (!existing) {
    return json({ error: "Группа не найдена." }, 404);
  }

  await env.DB.prepare("DELETE FROM bale_groups WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function login(request, env) {
  const input = await readJson(request);
  const username = String(input?.username || "").trim();
  const password = String(input?.password || "");

  if (!username || !password) {
    return json({ error: "Введите логин и пароль." }, 400);
  }

  const user = await verifyPassword(username, password);
  if (!user) {
    return json({ error: "Неверный логин или пароль." }, 401);
  }

  const token = await createSessionToken(user, env);
  return jsonWithHeaders(
    { user: publicUser(user) },
    {
      "Set-Cookie": sessionCookie(token, request),
    }
  );
}

async function logout(request) {
  return jsonWithHeaders(
    { ok: true },
    {
      "Set-Cookie": expiredSessionCookie(request),
    }
  );
}

function getApiGroupId(pathname) {
  const match = pathname.match(/^\/api\/groups\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function handleApi(request, env, url) {
  const user = await readSession(request, env);
  const id = getApiGroupId(url.pathname);

  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    return json({ user: publicUser(user) });
  }
  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    return login(request, env);
  }
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return logout(request);
  }

  if (url.pathname === "/api/groups") {
    if (request.method === "GET") {
      const error = requireUser(user);
      if (error) return error;
      return listGroups(env);
    }
    if (request.method === "POST") {
      const error = requireAdmin(user);
      if (error) return error;
      return createGroup(request, env);
    }
  }

  if (id) {
    if (request.method === "GET") return getGroup(env, id);
    if (request.method === "PUT") {
      const error = requireAdmin(user);
      if (error) return error;
      return updateGroup(request, env, id);
    }
    if (request.method === "DELETE") {
      const error = requireAdmin(user);
      if (error) return error;
      return deleteGroup(env, id);
    }
  }

  return json({ error: "Маршрут API не найден." }, 404);
}

function assetRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}

function htmlPath(pathname) {
  const cleanPath = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;

  if (cleanPath === "/") return "/index.html";
  if (cleanPath === "/admin" || cleanPath === "/admin/new" || cleanPath.startsWith("/admin/edit/")) {
    return "/admin.html";
  }
  if (cleanPath.startsWith("/group/")) return "/group.html";
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    const html = htmlPath(url.pathname);
    if (html) {
      return env.ASSETS.fetch(assetRequest(request, html));
    }

    return env.ASSETS.fetch(request);
  },
};
