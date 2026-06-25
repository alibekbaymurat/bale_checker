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
  person.svg
  qrcode.min.js
src/
  index.js
migrations/
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

Для существующей базы после обновления с новыми полями:

```bash
npm run db:migrate:remote
```

## Авторизация

Встроены роли:

- `user` - может входить в личный кабинет, смотреть список групп и открывать карточки групп.
- `admin` - может создавать, редактировать и удалять группы.
- Без входа доступна только публичная карточка группы по QR: `/group/:id`.

Для production задайте секрет подписи cookie-сессий:

```bash
npx wrangler secret put SESSION_SECRET
```

Сессия хранится в браузере 30 дней в `HttpOnly` cookie.

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
- `/admin/group/:id` - полная информация по группе в личном кабинете
- `/group/:id` - публичная страница для QR

API:

- `GET /api/groups`
- `GET /api/groups/:id`
- `POST /api/groups`
- `PUT /api/groups/:id`
- `DELETE /api/groups/:id`
