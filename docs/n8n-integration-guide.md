# n8n Integration Guide — Jens Platform

> Полное описание всех n8n-функций, файлов, эндпоинтов, компонентов и инструкций по использованию.

---

## Оглавление

1. [Общая архитектура](#1-общая-архитектура)
2. [Файлы и их назначение](#2-файлы-и-их-назначение)
3. [Переменные окружения (.env)](#3-переменные-окружения-env)
4. [server/n8n-bridge.js — Модуль интеграции (Backend)](#4-servern8n-bridgejs--модуль-интеграции-backend)
5. [server/index.js — API Endpoints (Backend)](#5-serverindexjs--api-endpoints-backend)
6. [src/services/api.ts — Frontend API функции](#6-srcservicesapits--frontend-api-функции)
7. [src/components/N8nPanel/N8nStatusPanel.tsx — UI панель](#7-srccomponentsn8npaneln8nstatuspaneltsx--ui-панель)
8. [scripts/n8n-test.mjs — Тестовый скрипт](#8-scriptsn8n-testmjs--тестовый-скрипт)
9. [docker-compose.yml — Локальная инфраструктура](#9-docker-composeyml--локальная-инфраструктура)
10. [Webhook Endpoints n8n](#10-webhook-endpoints-n8n)
11. [Привязка к модулям Jens](#11-привязка-к-модулям-jens)
12. [Известные проблемы и ограничения](#12-известные-проблемы-и-ограничения)
13. [Примеры вызовов (curl / fetch)](#13-примеры-вызовов-curl--fetch)
14. [Как запустить и проверить](#14-как-запустить-и-проверить)

---

## 1. Общая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        БРАУЗЕР (React)                          │
│                                                                 │
│  N8nStatusPanel.tsx                                             │
│  ├─ getN8nHealth()          → GET  /api/n8n/health              │
│  ├─ getN8nWorkflows()       → GET  /api/n8n/workflows           │
│  ├─ getN8nExecutions()      → GET  /api/n8n/executions          │
│  └─ triggerN8nWorkflow()    → POST /api/n8n/trigger/:path       │
│         │                                                       │
└─────────┼───────────────────────────────────────────────────────┘
          │ HTTP запросы к Express
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS BACKEND (:3001)                       │
│                                                                 │
│  server/index.js                                                │
│  ├─ GET  /api/n8n/health           → n8nBridge.checkHealth()    │
│  ├─ GET  /api/n8n/workflows        → n8nBridge.listWorkflows()  │
│  ├─ GET  /api/n8n/executions       → n8nBridge.getExecutions()  │
│  ├─ GET  /api/n8n/status/:id       → n8nBridge.getWorkflowStatus()
│  └─ POST /api/n8n/trigger/:path    → n8nBridge.triggerWorkflow()│
│         │                                                       │
│  server/n8n-bridge.js  ← модуль-посредник                       │
│         │                                                       │
└─────────┼───────────────────────────────────────────────────────┘
          │ HTTP запросы к n8n API / webhooks
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     n8n INSTANCE (:5678)                         │
│                                                                 │
│  /healthz                       ← проверка доступности          │
│  /api/v1/workflows              ← список workflow               │
│  /api/v1/executions             ← история выполнений            │
│  /api/v1/executions/:id         ← статус конкретного запуска    │
│  /webhook/telegram-bot-5zNg8gkl ← CWICR v10.9 бот             │
│  /webhook/telegram-bot-ygHTL-eo ← Text Estimator v11           │
│  /webhook/run-cYpR0z9b          ← n8n_1 Converter              │
│  /webhook/run-DO7lywP4          ← n8n_2 Converter              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Поток данных:**
1. Пользователь открывает `/n8n` в браузере
2. React компонент вызывает API-функции из `src/services/api.ts`
3. Запросы идут на Express backend (`server/index.js`, порт 3001)
4. Backend использует `server/n8n-bridge.js` для обращения к n8n
5. n8n-bridge отправляет запросы к n8n API или webhook endpoints
6. Ответ возвращается обратно по цепочке в UI

---

## 2. Файлы и их назначение

| Файл | Тип | Назначение |
|------|-----|-----------|
| `server/n8n-bridge.js` | Backend модуль | Ядро интеграции — все функции общения с n8n API |
| `server/index.js` (строки 1800-1860) | Backend routes | 5 REST эндпоинтов `/api/n8n/*` |
| `src/services/api.ts` (строки 400-450) | Frontend сервис | 5 функций для вызова backend API из React |
| `src/components/N8nPanel/N8nStatusPanel.tsx` | React компонент | UI панель управления n8n |
| `src/App.tsx` | Роутинг | Маршрут `/n8n` → N8nStatusPanel |
| `src/components/Layout/Sidebar.tsx` | Навигация | Пункт "n8n Workflows" в боковом меню |
| `src/components/Layout/TopBar.tsx` | Хлебные крошки | Breadcrumb "Modules > n8n Workflows" |
| `scripts/n8n-test.mjs` | CLI скрипт | Автономное тестирование всех n8n endpoints |
| `docker-compose.yml` | Инфраструктура | Локальный n8n + Qdrant через Docker |
| `.env` | Конфиг | Переменные `N8N_URL`, `N8N_WEBHOOK_BASE_URL`, `N8N_API_KEY` |

---

## 3. Переменные окружения (.env)

```env
# Адрес n8n API — используется для REST API запросов (list workflows, executions)
N8N_URL=http://localhost:5678

# Адрес для webhook-ов — может отличаться от N8N_URL если используется tunnel
# Например, Cloudflare tunnel для доступа извне (Telegram webhook-и)
N8N_WEBHOOK_BASE_URL=https://actor-won-translation-supervisor.trycloudflare.com

# API ключ для аутентификации n8n REST API (опционально)
# Если пустой — запросы отправляются без заголовка X-N8N-API-KEY
N8N_API_KEY=
```

### Когда использовать разные URL

| Переменная | Когда | Пример |
|-----------|-------|--------|
| `N8N_URL` | Всегда — для REST API (`/api/v1/*`) | `http://localhost:5678` |
| `N8N_WEBHOOK_BASE_URL` | Для webhook POST запросов | `https://xxx.trycloudflare.com` |

**Почему два URL?**
- REST API (`/api/v1/workflows`) работает только на прямом адресе n8n
- Webhook-и могут быть доступны через tunnel (для Telegram, внешних сервисов)
- Если tunnel не используется, оба значения = `http://localhost:5678`

---

## 4. server/n8n-bridge.js — Модуль интеграции (Backend)

**Расположение:** `server/n8n-bridge.js`
**Используется в:** `server/index.js` (импорт: `import n8nBridge from './n8n-bridge.js'`)

### 4.1 `checkHealth()`

**Что делает:** Проверяет, доступен ли n8n — пингует эндпоинт `/healthz`

**Вход:** нет параметров

**Выход:**
```js
{ online: true, url: "http://localhost:5678" }   // n8n работает
{ online: false, url: "http://localhost:5678" }  // n8n недоступен
```

**Как работает:**
1. Отправляет GET запрос на `{N8N_URL}/healthz` с таймаутом 5 секунд
2. Если ответ HTTP 200 — `online: true`
3. Если ошибка сети или таймаут — `online: false` (не бросает исключение)

**Где используется:**
- `GET /api/n8n/health` — Express endpoint
- `N8nStatusPanel.tsx` — показывает карточку "Online/Offline"

**Как вызвать напрямую (из backend кода):**
```js
import n8nBridge from './n8n-bridge.js'
const { online, url } = await n8nBridge.checkHealth()
console.log(online ? 'n8n работает' : 'n8n недоступен')
```

---

### 4.2 `listWorkflows()`

**Что делает:** Получает список ВСЕХ workflow-ов из n8n (активных и неактивных)

**Вход:** нет параметров

**Выход:** массив объектов:
```js
[
  {
    id: "abc123",                        // ID workflow в n8n
    name: "CWICR v10.9 Telegram Bot",   // Название
    active: true,                        // Активирован ли
    createdAt: "2025-01-15T...",         // Дата создания
    updatedAt: "2025-02-01T...",         // Дата последнего обновления
    tags: ["telegram", "cwicr"]          // Теги (если есть)
  },
  // ...
]
```

**Как работает:**
1. GET запрос на `{N8N_URL}/api/v1/workflows`
2. Добавляет заголовок `X-N8N-API-KEY` если `N8N_API_KEY` задан в .env
3. Парсит ответ, извлекает нужные поля
4. При ошибке — бросает исключение `"Failed to list workflows: HTTP {status}"`

**Где используется:**
- `GET /api/n8n/workflows` — Express endpoint
- `N8nStatusPanel.tsx` — вкладка "Workflows" — список с badge Active/Inactive

**Как вызвать:**
```js
const workflows = await n8nBridge.listWorkflows()
workflows.forEach(wf => console.log(`${wf.name}: ${wf.active ? 'ON' : 'OFF'}`))
```

---

### 4.3 `getExecutions(workflowId?, limit?)`

**Что делает:** Получает историю выполнений workflow-ов (лог запусков)

**Вход:**
| Параметр | Тип | По умолчанию | Описание |
|----------|-----|-------------|----------|
| `workflowId` | string (опц.) | — | Фильтр по конкретному workflow |
| `limit` | number | 20 | Максимум записей |

**Выход:** массив объектов:
```js
[
  {
    id: "exec_456",                    // ID выполнения
    workflowId: "abc123",             // ID workflow
    workflowName: "CWICR v10.9",     // Название workflow (может быть null)
    status: "success",                // "success" | "error" | "running"
    startedAt: "2025-02-09T10:30:00Z",
    stoppedAt: "2025-02-09T10:30:05Z",
    mode: "webhook"                   // Как запущен: "webhook" | "manual" | "trigger"
  },
  // ...
]
```

**Как работает:**
1. GET на `{N8N_URL}/api/v1/executions?limit={limit}`
2. Если `workflowId` передан — добавляет `&workflowId={id}`
3. Нормализует статусы (finished → success)

**Где используется:**
- `GET /api/n8n/executions` — Express endpoint (поддерживает query params `?workflowId=X&limit=10`)
- `N8nStatusPanel.tsx` — вкладка "Executions" — лог с иконками статусов

**Как вызвать:**
```js
// Все последние выполнения
const all = await n8nBridge.getExecutions()

// Только для конкретного workflow, последние 5
const specific = await n8nBridge.getExecutions('abc123', 5)
```

---

### 4.4 `getWorkflowStatus(executionId)`

**Что делает:** Получает детальный статус ОДНОГО выполнения по его ID

**Вход:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| `executionId` | string | ID выполнения (получается из `getExecutions`) |

**Выход:** полный объект выполнения из n8n (структура зависит от версии n8n):
```js
{
  id: "exec_456",
  workflowId: "abc123",
  finished: true,
  mode: "webhook",
  startedAt: "2025-02-09T10:30:00Z",
  stoppedAt: "2025-02-09T10:30:05Z",
  status: "success",
  data: { /* результаты каждого node */ },
  workflowData: { /* копия workflow на момент запуска */ }
}
```

**Где используется:**
- `GET /api/n8n/status/:executionId` — Express endpoint
- Пока не используется в UI, но подготовлен для детального просмотра

**Как вызвать:**
```js
const execution = await n8nBridge.getWorkflowStatus('exec_456')
console.log(`Status: ${execution.status}, Duration: ${execution.stoppedAt - execution.startedAt}`)
```

**Где внедрять в будущем:**
- Модальное окно в N8nPanel при клике на execution → показать детали
- Polling статуса после trigger (каждые 2 сек проверять, завершилось ли)

---

### 4.5 `triggerWorkflow(webhookPath, data)`

**Что делает:** Запускает workflow через его webhook URL — отправляет POST с данными

**Вход:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| `webhookPath` | string | Путь webhook: `"run-cYpR0z9b"` или `/webhook/run-cYpR0z9b` |
| `data` | object | JSON payload для отправки в workflow |

**Выход:**
```js
{
  status: 200,           // HTTP статус ответа от n8n
  data: { ... }          // Тело ответа (зависит от workflow)
}
```

**Как работает:**
1. Если путь не начинается с `/` — добавляет `/webhook/` перед ним
2. Формирует URL: `{N8N_WEBHOOK_BASE_URL}/webhook/{webhookPath}`
3. Отправляет POST с `Content-Type: application/json`
4. Таймаут: 30 секунд
5. Пытается распарсить ответ как JSON, если не получается — как text

**ВАЖНО:** Использует `N8N_WEBHOOK_BASE_URL` (не `N8N_URL`), потому что webhook-и могут быть за tunnel.

**Где используется:**
- `POST /api/n8n/trigger/:webhookPath` — Express endpoint
- `N8nStatusPanel.tsx` — кнопка "Trigger" рядом с каждым workflow

**Как вызвать:**
```js
// Запустить CWICR бот
const result = await n8nBridge.triggerWorkflow('telegram-bot-5zNg8gkl', {
  message: 'Test from backend',
  userId: 'admin'
})
console.log(`Response: HTTP ${result.status}`, result.data)

// Запустить конвертер n8n_1
const convert = await n8nBridge.triggerWorkflow('run-cYpR0z9b', {
  filePath: '/uploads/model.rvt',
  outputFormat: 'ifc'
})
```

**Где внедрять:**
- `Converter` модуль — после конвертации файла автоматически запускать валидацию через n8n
- `Cost Estimate` — кнопка "Рассчитать через CWICR n8n"
- `Project Mgmt` — при создании задачи → Telegram уведомление через n8n

---

### 4.6 `WORKFLOW_MODULES` — маппинг workflow к модулям Jens

**Что это:** Объект-справочник, связывающий модули Jens Platform с конкретными webhook-ами n8n

```js
export const WORKFLOW_MODULES = {
  converter: [
    { webhook: '/webhook/run-cYpR0z9b', name: 'n8n_1 Converter' },
    { webhook: '/webhook/run-DO7lywP4', name: 'n8n_2 Converter' },
  ],
  costEstimate: [
    { webhook: '/webhook/telegram-bot-5zNg8gkl', name: 'CWICR v10.9' },
  ],
  projectMgmt: [],   // Пока пусто — можно добавить Telegram уведомления
  validation: [],     // Пока пусто — можно добавить фоновую валидацию
  qto: [],            // Пока пусто — можно добавить генерацию отчётов
}
```

**Где внедрять:** Использовать для автоматического выбора нужного webhook при вызове из конкретного модуля:
```js
import n8nBridge from './n8n-bridge.js'

// В обработчике конвертации:
const converterWorkflows = n8nBridge.WORKFLOW_MODULES.converter
for (const wf of converterWorkflows) {
  await n8nBridge.triggerWorkflow(wf.webhook, { file: 'model.rvt' })
}
```

---

### 4.7 Вспомогательные функции (внутренние)

#### `apiHeaders()`
Формирует заголовки для запросов к n8n REST API. Если `N8N_API_KEY` задан — добавляет `X-N8N-API-KEY`.

#### `safeFetch(url, options, timeoutMs)`
Обёртка над `fetch()` с таймаутом (по умолчанию 30 сек). Использует `AbortController`. При ошибке сети бросает `"n8n unreachable: {причина}"`.

---

## 5. server/index.js — API Endpoints (Backend)

**Расположение:** `server/index.js`, строки 1800-1860
**Базовый URL:** `http://localhost:3001/api/n8n/`

### 5.1 `GET /api/n8n/health`

**Назначение:** Проверить, доступен ли n8n
**Параметры:** нет
**Ответ (200):**
```json
{ "online": true, "url": "http://localhost:5678" }
```
**Ответ (n8n недоступен):**
```json
{ "online": false, "url": "http://localhost:5678" }
```
**Особенность:** Никогда не возвращает ошибку HTTP — всегда 200, даже если n8n offline

---

### 5.2 `GET /api/n8n/workflows`

**Назначение:** Получить список всех workflow-ов
**Параметры:** нет
**Ответ (200):**
```json
[
  { "id": "1", "name": "CWICR v10.9", "active": true, "createdAt": "...", "updatedAt": "...", "tags": [] },
  { "id": "2", "name": "n8n_1 converter", "active": true, "createdAt": "...", "updatedAt": "...", "tags": [] }
]
```
**Ответ (502 — n8n недоступен):**
```json
{ "error": "Cannot reach n8n", "message": "n8n unreachable: fetch failed" }
```

---

### 5.3 `GET /api/n8n/executions`

**Назначение:** Получить историю выполнений
**Query параметры:**
| Параметр | Тип | По умолчанию | Описание |
|----------|-----|-------------|----------|
| `workflowId` | string | — | Фильтр по workflow |
| `limit` | number | 20 | Максимум записей |

**Пример:** `GET /api/n8n/executions?workflowId=abc123&limit=5`

**Ответ (200):**
```json
[
  {
    "id": "exec_1",
    "workflowId": "abc123",
    "workflowName": "CWICR v10.9",
    "status": "success",
    "startedAt": "2025-02-09T10:30:00Z",
    "stoppedAt": "2025-02-09T10:30:05Z",
    "mode": "webhook"
  }
]
```

---

### 5.4 `GET /api/n8n/status/:executionId`

**Назначение:** Получить детали конкретного выполнения
**Параметры:** `executionId` в URL
**Пример:** `GET /api/n8n/status/exec_456`
**Ответ:** полный объект execution из n8n API

---

### 5.5 `POST /api/n8n/trigger/:webhookPath`

**Назначение:** Запустить workflow через webhook
**Параметры:**
- URL: `webhookPath` — идентификатор webhook (например `run-cYpR0z9b`)
- Body: JSON с произвольными данными для workflow

**Пример:**
```
POST /api/n8n/trigger/run-cYpR0z9b
Content-Type: application/json

{
  "filePath": "/uploads/model.rvt",
  "outputFormat": "ifc",
  "source": "jens-platform"
}
```

**Ответ:** Зависит от workflow — прокидывает статус и тело ответа от n8n

---

## 6. src/services/api.ts — Frontend API функции

**Расположение:** `src/services/api.ts`, строки 400-450
**Используются в:** `N8nStatusPanel.tsx` и любом другом React-компоненте

### 6.1 `getN8nHealth()`

```typescript
export async function getN8nHealth(): Promise<{ online: boolean; url: string }>
```
- Вызывает: `GET /api/n8n/health`
- Возвращает: `{ online: boolean, url: string }`
- Использование в React:
```tsx
const { online, url } = await getN8nHealth()
```

### 6.2 `getN8nWorkflows()`

```typescript
export async function getN8nWorkflows(): Promise<N8nWorkflow[]>
```
- Вызывает: `GET /api/n8n/workflows`
- Тип `N8nWorkflow`: `{ id, name, active, createdAt, updatedAt, tags }`

### 6.3 `getN8nExecutions(workflowId?, limit?)`

```typescript
export async function getN8nExecutions(workflowId?: string, limit?: number): Promise<N8nExecution[]>
```
- Вызывает: `GET /api/n8n/executions?limit=20&workflowId=...`
- Тип `N8nExecution`: `{ id, workflowId, workflowName, status, startedAt, stoppedAt, mode }`

### 6.4 `getN8nExecutionStatus(executionId)`

```typescript
export async function getN8nExecutionStatus(executionId: string): Promise<N8nExecution>
```
- Вызывает: `GET /api/n8n/status/{executionId}`

### 6.5 `triggerN8nWorkflow(webhookPath, data)`

```typescript
export async function triggerN8nWorkflow(webhookPath: string, data: Record<string, unknown>): Promise<unknown>
```
- Вызывает: `POST /api/n8n/trigger/{webhookPath}`
- `data` — произвольный JSON для отправки в n8n workflow

### Как использовать в любом React-компоненте

```tsx
import { getN8nHealth, triggerN8nWorkflow } from '../../services/api'

// Проверить статус
const { online } = await getN8nHealth()

// Запустить workflow
await triggerN8nWorkflow('run-cYpR0z9b', {
  filePath: '/uploads/model.rvt',
  action: 'convert'
})
```

---

## 7. src/components/N8nPanel/N8nStatusPanel.tsx — UI панель

**Расположение:** `src/components/N8nPanel/N8nStatusPanel.tsx`
**Маршрут:** `/n8n` (добавлен в `App.tsx`)
**Навигация:** Sidebar → "n8n Workflows" (иконка Workflow)

### Что содержит панель

#### Заголовок
- "n8n Workflows" + описание
- Кнопка **Refresh** — перезагружает все данные

#### 4 Stat-карточки
| Карточка | Данные | Цвет |
|----------|--------|------|
| n8n Status | Online / Offline | Зелёный / Красный |
| Total Workflows | Общее количество | Синий |
| Active Workflows | Количество активных | Зелёный |
| Recent Errors | Ошибки в executions | Жёлтый / Зелёный |

#### Предупреждение (если n8n offline)
- Красная карточка с инструкцией как запустить n8n
- Показывает текущий URL из `.env`

#### Вкладка "Workflows"
- Список всех workflow-ов из n8n
- Каждый элемент показывает: имя, ID, дату обновления, badge Active/Inactive
- Зелёный индикатор для активных
- Кнопка **Trigger** — запускает workflow (только для известных webhook-ов, только если n8n online)

#### Вкладка "Executions"
- Список последних выполнений
- Иконки: CheckCircle (success), XCircle (error), Clock (running)
- Badge со статусом: success / error / running
- Время запуска и режим (webhook / manual)

#### Блок "Integration Notes"
- Предупреждения о Qdrant, tunnel, CAD workflows
- Зелёная отметка для Photo Cost Estimate

### Известные webhook маппинги (внутри компонента)

Компонент знает, какие workflow-ы имеют webhook-и для ручного запуска:

```
"CWICR v10.9..."    → telegram-bot-5zNg8gkl
"Text Estimator..." → telegram-bot-ygHTL-eo
"n8n_1 converter"   → run-cYpR0z9b
"n8n_2 converter"   → run-DO7lywP4
```

Если имя workflow содержит начало одного из ключей — рядом появляется кнопка Trigger.

### Как загружает данные

При монтировании компонента (первый рендер):
1. `Promise.allSettled([getN8nHealth(), getN8nWorkflows(), getN8nExecutions()])`
2. Три запроса параллельно — если один упадёт, остальные всё равно отобразятся
3. При нажатии Refresh — повторяет все три запроса
4. После Trigger — ждёт 2 секунды и делает Refresh (чтобы новое execution появилось)

---

## 8. scripts/n8n-test.mjs — Тестовый скрипт

**Расположение:** `scripts/n8n-test.mjs`
**Запуск:** `node scripts/n8n-test.mjs`

**Это автономный скрипт** — не зависит от Express backend, не зависит от React. Напрямую обращается к n8n и Telegram API.

### Конфигурация (строки 9-18)

```js
N8N_BASE = process.env.N8N_URL || 'https://actor-won-translation-supervisor.trycloudflare.com'
TELEGRAM_TOKEN = '7579656533:AAHlGxCm2kRRtjauanKvxpEfNY9KV6LmCdo'
```

Можно переопределить через env:
```bash
N8N_URL=http://localhost:5678 node scripts/n8n-test.mjs
```

### 6 тестовых секций

#### Тест 1: `testHealth()`
- GET `{N8N_BASE}/healthz`
- PASS если HTTP 200, FAIL если недоступен
- Если FAIL — тесты 2-4 пропускаются

#### Тест 2: `testListWorkflows()`
- GET `{N8N_BASE}/api/v1/workflows`
- Показывает список с пометками ACTIVE/INACTIVE
- PASS если получен список

#### Тест 3: `testExecutions()`
- GET `{N8N_BASE}/api/v1/executions?limit=20`
- Считает success/error/unknown
- Показывает последние 5 с деталями

#### Тест 4: `testWebhooks()`
- POST с тестовыми данными на 4 webhook-а:
  - `/webhook/telegram-bot-5zNg8gkl` — CWICR v10.9
  - `/webhook/telegram-bot-ygHTL-eo` — Text Estimator v11
  - `/webhook/run-cYpR0z9b` — n8n_1 Converter
  - `/webhook/run-DO7lywP4` — n8n_2 Converter
- PASS = HTTP 200/201, WARN = 404 (workflow неактивен), FAIL = недоступен

#### Тест 5: `testTelegramWebhookInfo()`
- GET `https://api.telegram.org/bot{TOKEN}/getWebhookInfo`
- Проверяет: установлен ли webhook URL, есть ли ошибки, сколько pending updates
- **Работает даже если n8n offline** — проверяет настройку Telegram

#### Тест 6: `testFormTrigger()`
- GET `{N8N_BASE}/form/run-DO7lywP4`
- Проверяет, отдаёт ли n8n HTML форму
- PASS если в ответе есть `<form>` / `<input>` / `<html>`

### Итоговый отчёт

```
============================================================
  n8n Test Report
============================================================
  Passed: 5
  Failed: 1
  Warnings: 2
============================================================

  Known Issues & Recommendations:
  ──────────────────────────────────
  ! Qdrant not deployed — CWICR semantic search disabled
  ! OpenAI API missing — replace with Gemini for embeddings
  ~ Cloudflare tunnel URL is temporary — webhook URLs will break
  ~ Hardcoded paths (C:\Users\Artem Boiko\...) in CAD workflows
  ~ CAD workflows (n8n_1-9) require local RvtExporter.exe
  + Photo Cost Estimate Pro v2.0 — should work (form trigger)
  + CWICR Telegram bots — will work after Qdrant + embeddings
```

---

## 9. docker-compose.yml — Локальная инфраструктура

**Расположение:** `docker-compose.yml` (корень проекта)

### Сервисы

#### n8n (порт 5678)
```
URL:      http://localhost:5678
Логин:    admin
Пароль:   jens2024
Timezone: Europe/Berlin
```
- Данные хранятся в Docker volume `n8n_data`
- При удалении контейнера данные сохраняются
- Для очистки: `docker volume rm revit_n8n_data`

#### Qdrant (порт 6333)
```
REST API: http://localhost:6333
gRPC:     localhost:6334
Dashboard: http://localhost:6333/dashboard
```
- Данные хранятся в Docker volume `qdrant_data`
- Используется для CWICR семантического поиска (когда коллекции загружены)

### Команды

```bash
# Запустить оба сервиса
docker-compose up -d

# Проверить статус
docker-compose ps

# Логи n8n
docker-compose logs -f n8n

# Логи Qdrant
docker-compose logs -f qdrant

# Остановить
docker-compose down

# Остановить и удалить данные
docker-compose down -v
```

---

## 10. Webhook Endpoints n8n

Все webhook-и, зарегистрированные в n8n:

| Webhook URL | Workflow | Метод | Назначение |
|-------------|----------|-------|-----------|
| `/webhook/telegram-bot-5zNg8gkl` | CWICR v10.9 #1 | POST | Telegram бот для оценки стоимости по CWICR справочнику |
| `/webhook/telegram-bot-ygHTL-eo` | Text Estimator v11 | POST | Telegram бот — текстовая оценка стоимости |
| `/webhook/run-cYpR0z9b` | n8n_1 Converter | POST | CAD конвертация (требует RvtExporter.exe) |
| `/webhook/run-DO7lywP4` | n8n_2 Converter | POST | CAD конвертация + form trigger |
| `/form/run-DO7lywP4` | n8n_2 (форма) | GET | HTML форма для загрузки файла в n8n_2 |

### Формат payload для webhook-ов

```json
{
  "source": "jens-platform",
  "timestamp": "2025-02-09T12:00:00Z",
  "filePath": "/uploads/model.rvt",
  "outputFormat": "ifc",
  "projectId": "project-123",
  "userId": "admin"
}
```

Каждый workflow сам решает, какие поля использовать. Лишние поля игнорируются.

---

## 11. Привязка к модулям Jens

### Текущая интеграция (уже работает)

| Модуль | Где в коде | Что происходит |
|--------|-----------|---------------|
| **N8n Panel** (`/n8n`) | `N8nStatusPanel.tsx` | Панель управления — статус, список, trigger |
| **Revit Upload** | `server/index.js:1612` | После upload-xlsx — опциональный POST на `N8N_WEBHOOK_URL` |

### Планируемая интеграция (где внедрять)

#### Converter (`/converter`) → n8n_1, n8n_2
**Файл:** `src/components/Converter/ConverterPage.tsx`
**Где:** После успешной конвертации
**Что добавить:**
```tsx
import { triggerN8nWorkflow } from '../../services/api'

// После получения результата конвертации:
await triggerN8nWorkflow('run-cYpR0z9b', {
  filePath: result.outputFile,
  action: 'validate-and-qto',
  source: 'jens-converter'
})
```

#### Cost Estimate (`/cost`) → CWICR v10.9
**Файл:** `src/components/CostEstimate/CostEstimatePage.tsx`
**Где:** Добавить кнопку "Рассчитать через n8n"
**Что добавить:**
```tsx
const handleN8nEstimate = async () => {
  const result = await triggerN8nWorkflow('telegram-bot-5zNg8gkl', {
    query: searchQuery,
    language: selectedLanguage,
    source: 'jens-cost'
  })
  // Показать результат
}
```

#### Project Mgmt (`/project`) → Telegram уведомления
**Файл:** `src/components/ProjectMgmt/ProjectMgmtPage.tsx` + `server/index.js` (POST /api/tasks)
**Где:** В backend при создании задачи
**Что добавить в server/index.js:**
```js
// После создания задачи:
try {
  await n8nBridge.triggerWorkflow('telegram-notification', {
    task: newTask,
    action: 'created',
    assignee: newTask.assignee
  })
} catch { /* non-blocking */ }
```

#### Validation (`/validation`) → фоновая валидация
**Файл:** `server/index.js` (POST /api/validation/run)
**Где:** Параллельно с локальной валидацией
**Что:** Запустить расширенную валидацию через n8n в фоне

#### QTO Reports (`/qto`) → генерация HTML отчёта
**Файл:** `server/index.js` (POST /api/qto/generate)
**Где:** После генерации QTO данных
**Что:** Отправить данные в n8n для генерации красивого HTML-отчёта

---

## 12. Известные проблемы и ограничения

### Критические

| Проблема | Затронуты | Решение |
|----------|-----------|---------|
| **Нет Qdrant** | CWICR боты, семантический поиск | `docker-compose up -d qdrant` + загрузить коллекции |
| **Нет OpenAI API** | Embeddings в CWICR workflows | Заменить на Gemini (ключ `GOOGLE_API_KEY` уже есть) |
| **RvtExporter.exe** | n8n_1 — n8n_9 (CAD) | Нужна Windows-машина с установленным Revit |

### Некритические

| Проблема | Описание | Решение |
|----------|----------|---------|
| **Tunnel URL временный** | Cloudflare tunnel URL меняется при перезапуске | Обновлять `N8N_WEBHOOK_BASE_URL` в `.env` |
| **Hardcoded пути** | `C:\Users\Artem Boiko\...` в CAD workflows | Обновить пути в Code-nodes в n8n |
| **executeCommand** | Может быть заблокирован в n8n Cloud | Использовать Code node вместо Execute Command |

### Что работает сейчас

| Workflow | Статус | Условие |
|----------|--------|---------|
| Photo Cost Estimate Pro v2.0 | Работает | n8n online + form trigger |
| CWICR Telegram боты | Частично | Нужен Qdrant + embeddings |
| n8n_1 — n8n_9 (CAD) | Не работает | Нужен RvtExporter.exe |

---

## 13. Примеры вызовов (curl / fetch)

### curl из терминала (через Express backend)

```bash
# Проверить статус n8n
curl http://localhost:3001/api/n8n/health

# Список workflows
curl http://localhost:3001/api/n8n/workflows

# Последние 5 выполнений
curl "http://localhost:3001/api/n8n/executions?limit=5"

# Статус выполнения
curl http://localhost:3001/api/n8n/status/exec_123

# Запустить workflow
curl -X POST http://localhost:3001/api/n8n/trigger/run-cYpR0z9b \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/test.rvt", "source": "curl-test"}'
```

### curl напрямую к n8n (минуя Express)

```bash
# Health
curl http://localhost:5678/healthz

# Список workflows (с API key)
curl -H "X-N8N-API-KEY: your-key" http://localhost:5678/api/v1/workflows

# Trigger webhook напрямую
curl -X POST http://localhost:5678/webhook/run-cYpR0z9b \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### fetch из браузера (через api.ts)

```typescript
import {
  getN8nHealth,
  getN8nWorkflows,
  getN8nExecutions,
  triggerN8nWorkflow
} from '../services/api'

// В React компоненте:
const health = await getN8nHealth()           // { online: true, url: "..." }
const workflows = await getN8nWorkflows()     // [{ id, name, active, ... }]
const executions = await getN8nExecutions()   // [{ id, status, ... }]
const result = await triggerN8nWorkflow('run-cYpR0z9b', { test: true })
```

---

## 14. Как запустить и проверить

### Вариант A: Только тест (без запуска n8n)

```bash
node scripts/n8n-test.mjs
```
Покажет какие endpoints доступны, какие нет. Telegram тест работает всегда.

### Вариант B: Полный локальный стек

```bash
# 1. Запустить n8n + Qdrant
docker-compose up -d

# 2. Открыть n8n UI
# http://localhost:5678 (admin / jens2024)

# 3. Запустить тест
node scripts/n8n-test.mjs

# 4. Запустить Jens Platform
npm run dev:all

# 5. Открыть n8n панель
# http://localhost:5173/n8n
```

### Вариант C: С удалённым n8n (Cloudflare tunnel)

```bash
# Обновить .env
N8N_WEBHOOK_BASE_URL=https://your-tunnel.trycloudflare.com

# Запустить тест
N8N_URL=https://your-tunnel.trycloudflare.com node scripts/n8n-test.mjs

# Запустить Jens
npm run dev:all
```
