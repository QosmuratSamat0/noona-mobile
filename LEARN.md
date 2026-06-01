# Backend проекта Noona AI

Этот файл описывает бэкенд-часть проекта: как она запускается, из каких слоев состоит, какие данные хранит, какие API дает клиентам и как проходит голосовой сценарий STT -> LLM -> TTS.

## Общая картина

Проект разделен на несколько частей:

- `backend/` - основной Go API-сервер.
- `ai-service/stt/` - Python-сервис распознавания речи, доступен по HTTP для health-check и по gRPC для транскрибации.
- `ai-service/tts/` - Python-сервис синтеза речи, доступен по HTTP для health-check и по gRPC для генерации аудио.
- `frontend-web/`, `mobile/`, `mobile_flutter/` - клиенты.
- `infra/`, `docker-compose.yml` - инфраструктура: PostgreSQL, Redis, MinIO и AI-сервисы.

Основной бэкенд написан на Go и находится в папке `backend`. Он принимает HTTP/WebSocket-запросы от клиентов, хранит пользователей, сессии, сообщения, активность и лингвистическую аналитику, а для AI-задач обращается к внешним провайдерам и Python-сервисам.

## Технологии

- Go, модуль `github.com/QosmuratSamat0/Noona-AI/backend`.
- HTTP-роутинг: `go-chi/chi`.
- Swagger: `swaggo/http-swagger`, документация доступна через `/docs/*`.
- PostgreSQL: основная реляционная база.
- Redis: очередь аудио-задач и часть кэша репозиториев.
- MinIO: объектное хранилище для аудиофайлов.
- JWT: access-токены для авторизации.
- Refresh-токены: хранятся в PostgreSQL.
- WebSocket: realtime-события для чата и аудио-пайплайна.
- gRPC: связь Go-бэкенда с STT/TTS Python-сервисами.
- LLM-провайдеры: Gemini, Groq или OpenRouter.

## Запуск

Инфраструктура поднимается из корня проекта:

```bash
docker compose up -d
```

Миграции PostgreSQL выполняются через Goose:

```bash
make migrate
```

Go API запускается так:

```bash
make dev
```

Или напрямую:

```bash
cd backend
go run cmd/api/main.go
```

По умолчанию HTTP-сервер слушает `0.0.0.0:8080`.

## Конфигурация

Конфиг загружается в `backend/internal/config/config.go` через переменные окружения.

Главные параметры:

- `ENV` - режим логирования: `local`, `dev`, `prod`.
- `DATABASE_URL` - строка подключения к PostgreSQL.
- `JWT_SECRET` - секрет для JWT.
- `REDIS_URL` - адрес Redis.
- `MINIO_ENDPOINT`, `MINIO_PUBLIC_ENDPOINT`, `MINIO_ACCESS_KEY_ID`, `MINIO_SECRET_ACCESS_KEY`, `MINIO_USE_SSL` - настройки MinIO.
- `STT_PROVIDER` - `grpc` или `groq`.
- `STT_GRPC_ADDR` - адрес локального STT gRPC-сервиса.
- `GROQ_API_KEY`, `GROQ_STT_URL`, `GROQ_STT_MODEL` - настройки Groq STT.
- `LLM_PROVIDER` - `gemini`, `groq` или `openrouter`.
- `GEMINI_API_KEY`, `GEMINI_MODEL` - Gemini.
- `GROQ_LLM_URL`, `GROQ_LLM_MODEL` - Groq LLM.
- `OPENROUTER_API_KEY`, `OPENROUTER_LLM_URL`, `OPENROUTER_LLM_MODEL` - OpenRouter.
- `TTS_GRPC_ADDR`, `TTS_REQUEST_TIMEOUT` - TTS.
- `AUDIO_WORKER_QUEUE`, `AUDIO_WORKER_COUNT` - очередь и количество воркеров.
- `ADDRESS`, `TIMEOUT`, `IDLE_TIMEOUT` - HTTP-сервер.

## Точка входа

Главный файл: `backend/cmd/api/main.go`.

Он делает следующее:

1. Загружает `.env`.
2. Читает конфиг.
3. Настраивает logger.
4. Создает приложение через `app.NewApp`.
5. Запускает HTTP-сервер.
6. При остановке корректно закрывает сервер, worker pool, БД, Redis и Gemini provider.

## Инициализация приложения

Основной файл: `backend/internal/app/app.go`.

`NewApp`:

1. Подключается к PostgreSQL через `pgxpool`.
2. Создает MinIO-клиент.
3. Инициализирует бакеты в MinIO.
4. Подключается к Redis.
5. Создает WebSocket hub.
6. Собирает зависимости через `BuildDeps`.
7. Запускает audio worker pool.
8. Создает `chi` router.
9. Подключает middleware: logger, recoverer, request id, CORS.
10. Регистрирует HTTP-модули.

`Run` запускает HTTP-сервер и слушает `SIGINT`/`SIGTERM`.

`Shutdown` останавливает сервер и закрывает ресурсы.

## Dependency Injection

Сборка зависимостей находится в `backend/internal/app/deps.go`.

Там создаются:

- repositories: user, auth, chat, linguistic, activity, audio MinIO, audio Redis;
- usecases: user, auth, chat, linguistic, activity, audio;
- STT-клиент: локальный gRPC faster-whisper или Groq;
- TTS-клиент: локальный gRPC Piper;
- LLM provider: Gemini, Groq или OpenRouter;
- WebSocket hub;
- audio processor;
- Redis worker pool.

Проект использует явные интерфейсы между слоями. Это видно в `deps_interfaces.go` и в `interfaces.go` внутри usecase-пакетов.

## Архитектурные слои

### `internal/delivery/http`

HTTP-слой. Здесь находятся handlers, request/response DTO и регистрация routes.

Модули:

- `auth` - регистрация, вход, обновление токенов, logout.
- `user` - профиль и управление пользователями.
- `chat` - сессии, сообщения, WebSocket.
- `audio` - загрузка аудио.
- `linguistic` - ошибки, переводы, коррекции.
- `activity` - streak и дневная активность.
- `middleware` - JWT auth, RBAC, rate limit, context helpers.

### `internal/usecase`

Бизнес-логика приложения.

- `auth` - регистрация, login, refresh, logout, генерация токенов.
- `user` - CRUD пользователей, роли, CEFR, native language.
- `chat` - сессии, сообщения, LLM-ответы, quick grammar feedback.
- `audio` - обработка аудио: upload, STT, feedback, deep analysis, TTS.
- `linguistic` - транскрипты, исправления, ошибки, перевод.
- `activity` - запись активности и получение статистики.

### `internal/domain`

Доменные модели: user, auth, chat, audio, linguistic, activity.

Здесь описаны сущности и базовые правила предметной области, например роли пользователей и права.

### `internal/infrastructure`

Реализации внешних зависимостей:

- PostgreSQL repositories.
- Redis repositories.
- MinIO repositories.
- STT clients.
- TTS client.
- LLM providers: Gemini, Groq, OpenRouter.
- Storage bootstrap.

### `internal/lib`

Вспомогательные библиотеки:

- API response wrapper.
- errors.
- logger.
- password hashing/checking.
- JWT и refresh token helpers.

### `pkg`

Переиспользуемые пакеты:

- `pkg/storage` - MinIO-клиент.
- `pkg/pb` - сгенерированные protobuf/gRPC клиенты для STT/TTS.

## HTTP API

Все основные API находятся под префиксом `/api/v1`.

Публичные auth routes:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`

Защищенные user routes:

- `GET /api/v1/users/me`
- `POST /api/v1/users/`
- `GET /api/v1/users/`
- `GET /api/v1/users/{id}`
- `PUT /api/v1/users/{id}`
- `DELETE /api/v1/users/{id}`

Защищенные chat routes:

- `POST /api/v1/sessions/`
- `GET /api/v1/sessions/`
- `GET /api/v1/sessions/{sessionID}/messages`
- `POST /api/v1/sessions/{sessionID}/messages`
- `GET /api/v1/ws/chat`

Защищенные audio routes:

- `POST /api/v1/audio/upload`

Защищенные linguistic routes:

- `GET /api/v1/linguistic/mistakes`
- `POST /api/v1/linguistic/translate`
- `GET /api/v1/linguistic/messages/{messageID}/corrections`

Защищенные activity routes:

- `GET /api/v1/activity/me`

Swagger:

- `GET /docs/*`

## Авторизация

Auth flow:

1. Пользователь регистрируется через `/auth/register`.
2. Пароль хэшируется через `internal/lib/passwordUtils`.
3. При login сервер проверяет пароль.
4. Сервер выдает access token и refresh token.
5. Access token - JWT на 15 минут.
6. Refresh token сохраняется в PostgreSQL на 30 дней.
7. При refresh старый refresh token удаляется и создается новый.
8. Защищенные routes используют `AuthMiddleware`.

Роли:

- `user`
- `admin`

Админские операции проверяются через доменные permission helpers.

## База данных

Миграции лежат в `backend/migrations`.

Таблицы:

- `users` - пользователи: имя, email, password hash, роль.
- `profiles` - профиль пользователя: CEFR, streak count, native language.
- `refresh_tokens` - refresh-токены.
- `sessions` - чат-сессии.
- `messages` - сообщения пользователя и AI, включая `audio_url`.
- `transcripts` - распознанный текст, может быть связан с message.
- `corrections` - исправления, объяснение и CEFR.
- `mistakes` - накопленные ошибки пользователя.
- `daily_stats` - дневная статистика.
- `streaks` - текущий и лучший streak.

## Чат

Чат работает через `internal/usecase/chat`.

Сценарий текстового сообщения:

1. Клиент создает или выбирает session.
2. Отправляет `POST /sessions/{sessionID}/messages`.
3. Бэкенд проверяет, что session принадлежит пользователю.
4. Сохраняет user message.
5. Через LLM получает quick feedback.
6. Сохраняет transcript/correction для grammar feedback.
7. Через LLM генерирует ответ coach.
8. Сохраняет AI message.
9. Возвращает AI message и feedback.

Если LLM недоступен, используется fallback reply.

## WebSocket

WebSocket hub находится в `backend/internal/chat/hub.go`.

Он хранит подключение по `userID`. Если пользователь подключился повторно, старый канал закрывается. Через hub backend отправляет события:

- `transcript_final`
- `quick_feedback`
- `deep_feedback`
- `coach_reply`
- `tts_ready`
- `user_audio_ready`
- `audio_error`
- `audio_processing_result`

WebSocket endpoint:

```text
GET /api/v1/ws/chat
```

Нужен JWT, как и для остальных защищенных routes.

## Аудио-пайплайн

Аудио загружается через:

```text
POST /api/v1/audio/upload
```

Форма содержит:

- `file` - аудиофайл.
- `session_id` - id chat session.

В текущей low-latency схеме `UploadAudio` сразу читает аудио в память, возвращает `job_id`, а обработку запускает в goroutine.

Fast path:

1. Прочитать аудио.
2. Вызвать STT.
3. Отправить `transcript_final` в WebSocket.
4. Сохранить user message в chat.
5. Получить quick feedback от LLM.
6. Отправить `quick_feedback`.

Background path:

1. Записать activity.
2. Загрузить аудио в MinIO.
3. Прикрепить audio URL к user message.
4. Сделать deep LLM analysis.
5. Сохранить transcript, correction и mistakes.
6. Отправить `deep_feedback`.
7. Сгенерировать coach reply.
8. Отправить `coach_reply`.
9. Сгенерировать TTS через gRPC.
10. Сохранить AI message с `audio_url`.
11. Отправить `tts_ready`.

В коде также есть классический worker path:

1. Аудио сохраняется в MinIO.
2. Job кладется в Redis queue.
3. `AudioWorker` забирает job через `BLMove`.
4. Job переносится в `in_progress`.
5. `AudioProcessor` делает STT, LLM analysis и WebSocket push.
6. При ошибке job переносится в DLQ.

## STT

STT выбирается через `STT_PROVIDER`.

Варианты:

- `grpc`, `local`, `faster-whisper` - локальный Python STT-сервис.
- `groq` - Groq audio transcription API.

Локальный gRPC-клиент использует protobuf из `pkg/pb/stt`.

## TTS

TTS-клиент находится в `internal/infrastructure/ai/tts`.

Он обращается к Python Piper-сервису по gRPC. Результатом является stream/URL аудиофайла, который затем отправляется клиенту через WebSocket и сохраняется в сообщении.

## LLM

LLM provider выбирается через `LLM_PROVIDER`.

Поддерживаются:

- `gemini`
- `groq`
- `openrouter`

LLM используется для:

- quick grammar feedback;
- deep linguistic analysis;
- streaming coach reply;
- translation на `ru` или `kk`.

## MinIO

MinIO используется для хранения аудио.

Бакеты:

- `voice-input` - входные пользовательские аудио.
- `voice-output` - TTS-ответы.

Go-бэкенд инициализирует storage при старте. Python TTS/STT сервисы тоже используют MinIO.

## Redis

Redis используется для:

- очереди аудио-задач;
- `in_progress` очереди;
- DLQ очереди;
- кэша в некоторых repository-реализациях.

Очередь по умолчанию:

```text
audio:jobs
```

## Activity

Activity записывается при создании chat session и при аудио-активности.

Сохраняются:

- daily stats;
- current streak;
- longest streak;
- last activity date.

Endpoint:

```text
GET /api/v1/activity/me
```

## Linguistic

Лингвистический модуль хранит:

- raw transcript;
- corrected text;
- explanation;
- CEFR level;
- mistakes.

Также он дает перевод текста на русский или казахский через LLM provider.

## Где искать код

- Старт сервера: `backend/cmd/api/main.go`
- App lifecycle: `backend/internal/app/app.go`
- DI: `backend/internal/app/deps.go`
- Config: `backend/internal/config/config.go`
- HTTP routes: `backend/internal/delivery/http/*/*_module.go`
- Handlers: `backend/internal/delivery/http/*/*.go`
- Use cases: `backend/internal/usecase/*`
- Domain models: `backend/internal/domain/*`
- Repositories: `backend/internal/infrastructure/repository/*`
- AI clients/providers: `backend/internal/infrastructure/ai/*`
- Worker: `backend/internal/worker/audio_worker.go`
- WebSocket hub: `backend/internal/chat/hub.go`
- Migrations: `backend/migrations`
- Swagger: `backend/docs`
- Protobuf-generated clients: `backend/pkg/pb`

## Файл со всем кодом бэкенда

В корне проекта создан файл:

```text
BACKEND_CODE.txt
```

Он содержит код и проектные текстовые файлы из папки `backend/`, склеенные в один документ: Go-файлы, миграции, Swagger/config-файлы, `go.mod`, `go.sum` и `.env.example`. Локальный `backend/.env` и служебный `.gocache` специально не включены, потому что это не исходный код и там могут быть локальные секреты/кэш. Перед каждым файлом стоит разделитель с исходным путем, например:

```text
================================================================================
FILE: backend/internal/app/app.go
================================================================================
```
