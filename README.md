# Bale Checker

Vanilla HTML/CSS/JS приложение для учета групп тюков на Cloudflare Worker, Static Assets и D1.

## Структура

```text
public/
  index.html
  admin.html
  group.html
  styles.css
  app.js
  qrcode.min.js
src/
  index.js
schema.sql
wrangler.toml
package.json
```

## Локальный запуск

```bash
npm install
npm run db:apply:local
npm run dev
```

Откройте URL, который покажет `wrangler dev`, обычно `http://localhost:8787`.

## Cloudflare D1

Создайте базу:

```bash
npx wrangler d1 create bale_checker_db
```

Скопируйте `database_id` в `wrangler.toml` вместо `PASTE_DATABASE_ID_HERE`, затем примените схему:

```bash
npm run db:apply:remote
```

## Деплой

```bash
npm run deploy
```

Деплой идет как обычный Worker со Static Assets. D1 binding задается в `wrangler.toml`:

- Binding name: `DB`
- Database name: `bale_checker_db`

## URL

- `/` - главная
- `/admin` - список групп
- `/admin/new` - создание группы
- `/admin/edit/:id` - редактирование группы
- `/group/:id` - публичная страница для QR

API:

- `GET /api/groups`
- `GET /api/groups/:id`
- `POST /api/groups`
- `PUT /api/groups/:id`
- `DELETE /api/groups/:id`
