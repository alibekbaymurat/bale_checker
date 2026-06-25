# Bale Checker

Vanilla HTML/CSS/JS приложение для учета групп тюков на Cloudflare Pages, Pages Functions и D1.

## Структура

```text
public/
  index.html
  admin.html
  group.html
  styles.css
  app.js
  qrcode.min.js
functions/
  api/
    groups/
      index.js
      [id].js
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

Откройте `http://localhost:8788`.

## Cloudflare D1

Создайте базу:

```bash
npx wrangler d1 create bale_checker_db
```

Скопируйте `database_id` в `wrangler.toml`, затем примените схему:

```bash
npm run db:apply:remote
```

## Деплой

```bash
npm run deploy
```

В Cloudflare Pages привяжите D1 database binding:

- Binding name: `DB`
- Database: `bale_checker_db`

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
