# Jens -- Construction Management Platform

## Overview

Jens is a unified construction management platform that brings together CAD/BIM file conversion, 3D model viewing, cost estimation, BIM validation, AI-powered data analysis, project management, document control, and quantity take-off reporting into a single web application.

The platform is designed for construction professionals -- project managers, BIM coordinators, estimators, and engineers -- who need a centralized workspace for managing digital construction data across the full project lifecycle.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, TypeScript 5.7, Tailwind CSS v4 |
| UI State | Zustand 5 |
| Routing | React Router v7 |
| Icons | Lucide React |
| Charts | Recharts 2 |
| 3D Rendering | Three.js 0.170, web-ifc 0.0.66, web-ifc-three 0.0.126 |
| Backend | Express.js 4.21 (ESM, Node.js) |
| AI | Google Gemini 2.0 Flash via @google/generative-ai |
| Database | Supabase Postgres |
| File Parsing | xlsx (SheetJS) for Excel/CSV |
| File Uploads | Multer (up to 500 MB) |
| Bot | Telegram (node-telegram-bot-api) |
| Automation | n8n (port 5678) |
| CSS Utilities | clsx, tailwind-merge |

---

## Architecture

```
+-------------------+         +-------------------+         +-------------------+
|                   |  proxy  |                   |         |                   |
|  React Frontend   | ------> |  Express Backend  | ------> |  Supabase         |
|  (port 5173)      |  /api   |  (port 3001)      |         |  Postgres         |
|                   |         |                   |         |                   |
+-------------------+         +-------------------+         +-------------------+
                                      |
                                      |  API calls
                                      v
                              +-------------------+
                              |                   |
                              |  Google Gemini    |
                              |  2.0 Flash        |
                              |                   |
                              +-------------------+

+-------------------+         +-------------------+
|                   |         |                   |
|  n8n Automation   |         |  Telegram Bot     |
|  (port 5678)      |         |                   |
|                   |         |                   |
+-------------------+         +-------------------+
```

### Frontend (React SPA)

- Runs on `http://localhost:5173` via Vite dev server
- Single-page application with React Router v7
- Eight route-based modules accessible from the sidebar
- Vite proxies all `/api` requests to the Express backend at port 3001
- Three.js viewport for 3D IFC rendering (client-side, no backend needed)
- WASM assets included (`web-ifc.wasm`) for IFC parsing in the browser
- Path alias `@/` maps to `src/`

### Backend (Express API)

- Runs on `http://localhost:3001`
- Single-file server at `server/index.js` (ESM module)
- Handles file uploads via Multer with disk storage in `uploads/`
- Integrates Google Gemini 2.0 Flash for AI features (classification, chat, analysis, meeting minutes)
- Loads CWICR Excel data into in-memory cache for cost estimation search
- Shells out to DDC converter executables for CAD/BIM file conversion
- In-memory data stores for tasks, documents, RFIs, and submittals (seed data included)
- Request logging middleware
- Global error handler with Multer-specific error handling
- 404 handler that lists all available endpoints
- Health endpoint with full system status

### Database (Supabase Postgres)

- Hosted Supabase instance for persistent storage
- Connection configured via `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables
- Currently used alongside in-memory stores in the Express server

### AI (Google Gemini 2.0 Flash)

- Initialized at server startup if `GOOGLE_API_KEY` is present
- Used for: element classification, data analysis, AI chat, meeting minutes generation, QTO HTML reports
- Graceful degradation: AI endpoints return 503 if no API key is configured
- Chat endpoint supports conversation history

### Automation (n8n)

- Self-hosted n8n instance at `http://localhost:5678`
- Managed via pm2 for process persistence
- 8 active workflow definitions for CAD conversion, validation, cost estimation, and reporting
- Connected to the platform via `N8N_URL` environment variable

### Bot (Telegram)

- Telegram bot integration via `node-telegram-bot-api`
- Bot token configured via `TELEGRAM_BOT_TOKEN` environment variable
- Used for task notifications and project management alerts

---

## Modules

### Module 1: CAD/BIM Converter

**Route:** `/converter`
**Component:** `src/components/Converter/ConverterPage.tsx`

**Description:**
Upload and convert CAD/BIM files between formats. Supports Revit (.rvt), IFC (.ifc), DWG (.dwg), and DGN (.dgn) input files. Conversion is performed by DDC converter executables that run as child processes on the server.

**Features:**
- Single file upload with format detection
- Output format selection (Excel, DAE, PDF)
- Real-time progress tracking
- Conversion history log (last 100 entries)
- Error reporting with converter diagnostics
- 500 MB maximum file size

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/converter/convert` | Upload and convert a CAD/BIM file |
| GET | `/api/converter/history` | Retrieve conversion history |

**CLI Tools (DDC Converter Executables):**

| Executable | Directory | Input Format |
|-----------|-----------|-------------|
| `RvtExporter.exe` | `DDC_CONVERTER_REVIT/` | Revit (.rvt) |
| `IfcExporter.exe` | `DDC_CONVERTER_IFC/` | IFC (.ifc) |
| `DwgExporter.exe` | `DDC_CONVERTER_DWG/` | DWG (.dwg) |
| `DgnExporter.exe` | `DDC_CONVERTER_DGN/` | DGN (.dgn) |

The converter executables are located under:
`cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto/`

**Related n8n Workflows:** n8n_1, n8n_2, n8n_3

---

### Module 2: 3D Viewer

**Route:** `/viewer`
**Component:** `src/components/Viewer3D/ViewerPage.tsx`

**Description:**
A Three.js-based 3D viewer for IFC building models. Renders models client-side using web-ifc for parsing and Three.js for visualization. Includes a spatial hierarchy tree, element selection with property inspection, and standard navigation tools.

**Features:**
- IFC file upload and client-side parsing
- Revit `.rvt` upload with backend auto-conversion pipeline (`RVT -> IFC + XLSX + DAE`) when converter is available
- Demo model loading (placeholder geometry)
- Selection tree (project > site > building > storey > element hierarchy)
- Element property panel with all IFC properties
- Navigation tools: Select, Pan, Rotate, Zoom
- Measurement tool (point-to-point distance)
- Section plane / clipping tool
- Fit to View / zoom reset
- Element visibility toggles
- Model statistics (element count, types, stories, materials, IFC version, file size)
- Shadow mapping with PCF soft shadows
- ACES filmic tone mapping
- Damped orbit controls

**No backend API needed** -- all rendering and IFC parsing happens in the browser.

**Rendering Setup:**
- WebGL renderer with antialiasing and HDR tone mapping
- PerspectiveCamera (60-degree FOV)
- OrbitControls with damping
- Three-light setup: ambient + directional (with shadows) + hemisphere
- 100x100 grid helper

---

### Module 3: CWICR Cost Estimation

**Route:** `/cost`
**Component:** `src/components/CostEstimate/CostEstimatePage.tsx`

**Description:**
Search, classify, and calculate construction costs using the DDC CWICR (Construction Work Items, Costs and Resources) open database. Contains 55,719 work items across 9 languages with city-specific pricing data.

**Features:**
- Full-text search across CWICR work items
- Multi-language support (9 languages)
- AI-powered element classification using Gemini
- Cost calculation with labor/material/equipment breakdowns
- Automatic markup application (overhead 10%, profit 8%, contingency 5%)
- Export capabilities

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/cost/search` | Search CWICR database by text query |
| POST | `/api/cost/classify` | AI-classify BIM elements into CWICR categories |
| POST | `/api/cost/calculate` | Calculate costs with markups from item list |

**Supported Languages and Cities:**

| Code | Language | City | Excel Data |
|------|----------|------|-----------|
| en | English | Toronto | Available |
| de | German | Berlin | Available |
| ru | Russian | St. Petersburg | Available |
| fr | French | Paris | Available |
| es | Spanish | Madrid | Directory only |
| ar | Arabic | Dubai | Directory only |
| zh | Chinese | Beijing | Directory only |
| hi | Hindi | Delhi | Directory only |
| pt | Portuguese | Sao Paulo | Directory only |

CWICR data is loaded from Excel files in `OpenConstructionEstimate-DDC-CWICR/` and cached in memory on first access per language.

**Related n8n Workflows:** n8n_5, n8n_6

---

### Module 4: BIM Validation

**Route:** `/validation`
**Component:** `src/components/Validation/ValidationPage.tsx`

**Description:**
Validate BIM model data against configurable rule sets. Checks element properties for completeness and correctness, producing a scored report with categorized issues.

**Features:**
- 8 built-in validation rules (configurable)
- Three severity levels: error, warning, info
- Overall pass/fail scoring (percentage-based)
- Strict mode option (warnings also cause failure)
- Per-element breakdown of check results
- HTML report export

**Default Validation Rules:**

| Rule ID | Name | Field | Check | Severity |
|---------|------|-------|-------|----------|
| R001 | Element Name Present | name | not_empty | error |
| R002 | Category Assigned | category | not_empty | error |
| R003 | Material Specified | material | not_empty | warning |
| R004 | Volume Greater Than Zero | volume | positive_number | error |
| R005 | Level Assignment | level | not_empty | warning |
| R006 | Classification Code | classificationCode | not_empty | info |
| R007 | Fire Rating Present | fireRating | not_empty | warning |
| R008 | Phase Defined | phase | not_empty | info |

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/validation/run` | Run validation rules against BIM data |

**Related n8n Workflows:** n8n_4

---

### Module 5: AI Data Analysis

**Route:** `/ai-analysis`
**Component:** `src/components/AIAnalysis/AIAnalysisPage.tsx`

**Description:**
Upload Excel/CSV files and describe analysis tasks in natural language. Jens AI (powered by Google Gemini 2.0 Flash) interprets the request, analyzes the data, generates code, and produces insights with optional charts and tables.

**Features:**
- File upload (Excel, CSV, JSON, XML, TXT)
- Natural language analysis prompts
- AI-generated code (JavaScript/Python)
- Chart generation
- Conversational AI chat with construction domain knowledge
- Context-aware responses with file data
- Quick analysis presets

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/analyze` | Upload file and analyze with AI |
| POST | `/api/ai/chat` | Conversational AI chat |

**AI Configuration:**
- Model: `gemini-2.0-flash`
- System prompt: Construction domain expert persona ("Jens AI")
- File context: First 100 rows of Excel data or first 50,000 characters of text files
- Chat history support for multi-turn conversations

---

### Module 6: Project Management

**Route:** `/project`
**Component:** `src/components/ProjectMgmt/ProjectMgmtPage.tsx`

**Description:**
Kanban-style board for managing construction project tasks. Supports four workflow stages with priority levels, assignees, due dates, and module tagging. Integrated with Telegram for notifications.

**Features:**
- Kanban board with four columns: To Do, In Progress, Review, Done
- Task cards with priority badges (low, medium, high, critical)
- Assignee management
- Due date tracking
- Module tagging (links tasks to platform modules)
- Filtering by status, priority, and module
- Telegram bot integration for task notifications

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List all tasks (supports query filters) |
| POST | `/api/tasks` | Create a new task |
| PUT | `/api/tasks/:id` | Update an existing task |

**Query Filters (GET /api/tasks):**
- `status` -- filter by task status
- `priority` -- filter by priority level
- `module` -- filter by platform module

**Task Schema:**
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "status": "todo | in-progress | review | done",
  "priority": "low | medium | high | critical",
  "assignee": "string",
  "dueDate": "ISO date string",
  "module": "string",
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime"
}
```

---

### Module 7: Document Control

**Route:** `/documents`
**Component:** `src/components/Documents/DocumentsPage.tsx`

**Description:**
Centralized document management for construction projects. Tracks project documents, RFIs (Requests for Information), submittals, and generates AI-powered meeting minutes from raw notes.

**Features:**
- Document register with type/category filtering
- RFI tracking with response threads
- Submittal management with review workflow
- AI meeting minutes generation from raw notes
- Document metadata (version, author, size, format)
- Spec section references for submittals

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/documents` | List documents (filter by type, category) |
| GET | `/api/rfis` | List RFIs (filter by status) |
| GET | `/api/submittals` | List submittals (filter by status, category) |
| POST | `/api/documents/meeting-minutes` | Generate meeting minutes from notes using AI |

**Meeting Minutes Request Body:**
```json
{
  "notes": "Raw meeting notes text (required)",
  "attendees": ["Name 1", "Name 2"],
  "agenda": "Meeting agenda description",
  "projectName": "Project name",
  "date": "2026-02-08"
}
```

**RFI Statuses:** Open, Answered, Closed, Overdue
**Submittal Statuses:** Submitted, Under Review, Approved, Rejected, Resubmit

---

### Module 8: QTO Reports

**Route:** `/qto`
**Component:** `src/components/QTOReports/QTOReportsPage.tsx`

**Description:**
Generate Quantity Take-Off reports from BIM data exports. Upload an Excel, CSV, or JSON file containing element data, and the system groups quantities by category, type, floor, or phase with automatic aggregation of volumes, areas, lengths, and weights.

**Features:**
- File upload (Excel, CSV, JSON)
- Grouping options: by category, type, floor, phase, or detailed
- Automatic quantity aggregation (volume, area, length, weight)
- Summary cards with totals
- AI-generated HTML reports (optional, requires Gemini)
- Export to Excel, PDF, or HTML

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/qto/generate` | Upload file and generate QTO report |

**Request Parameters (multipart form-data):**
- `file` -- Excel, CSV, or JSON file (required)
- `format` -- Output format: `json` (default) or `html`
- `groupBy` -- Grouping field: `category` (default), `type`, `floor`, `phase`

**Recognized Quantity Fields:**
The system automatically detects and aggregates these column names from the uploaded file:
- Volume: `Volume`, `volume`, `vol`
- Area: `Area`, `area`
- Length: `Length`, `length`, `len`
- Weight: `Weight`, `weight`, `mass`, `Mass`

**Related n8n Workflows:** n8n_9

---

## API Reference

All endpoints are served under the `/api` prefix. The Vite dev server proxies these requests to the Express backend at `http://localhost:3001`.

### Complete Endpoint List

| # | Method | Path | Auth | Body | Description |
|---|--------|------|------|------|-------------|
| 1 | POST | `/api/converter/convert` | No | multipart/form-data: `file`, `outputFormat` | Upload and convert a CAD/BIM file |
| 2 | GET | `/api/converter/history` | No | -- | Get conversion history (last 100) |
| 3 | POST | `/api/cost/search` | No | JSON: `query`, `language`, `limit` | Search CWICR work items |
| 4 | POST | `/api/cost/classify` | No | JSON: `elements[]`, `language` | AI-classify elements into CWICR codes |
| 5 | POST | `/api/cost/calculate` | No | JSON: `items[]` | Calculate costs with markups |
| 6 | POST | `/api/validation/run` | No | JSON: `data`, `rules[]`, `strict` | Validate BIM data against rules |
| 7 | POST | `/api/ai/analyze` | No | multipart/form-data: `file`, `prompt` | AI analysis of uploaded data |
| 8 | GET | `/api/tasks` | No | Query: `status`, `priority`, `module` | List tasks with optional filters |
| 9 | POST | `/api/tasks` | No | JSON: `title`, `description`, `status`, `priority`, `assignee`, `dueDate`, `module` | Create a new task |
| 10 | PUT | `/api/tasks/:id` | No | JSON: partial task fields | Update an existing task |
| 11 | GET | `/api/documents` | No | Query: `type`, `category` | List documents |
| 12 | GET | `/api/rfis` | No | Query: `status` | List RFIs |
| 13 | GET | `/api/submittals` | No | Query: `status`, `category` | List submittals |
| 14 | POST | `/api/documents/meeting-minutes` | No | JSON: `notes`, `attendees`, `agenda`, `projectName`, `date` | Generate AI meeting minutes |
| 15 | POST | `/api/qto/generate` | No | multipart/form-data: `file`, `format`, `groupBy` | Generate QTO report |
| 16 | POST | `/api/ai/chat` | No | JSON: `message`, `context`, `history[]` | Conversational AI chat |
| 17 | GET | `/api/health` | No | -- | System health and status |
| 18 | POST | `/api/revit/upload-xlsx` | No | multipart/form-data: `file`, optional `projectId`, `modelVersion` | Parse Revit XLSX and upsert element properties |
| 19 | GET | `/api/revit/properties/:globalId` | No | Query: `projectId`, `modelVersion` | Fetch single enriched element by GlobalId |
| 20 | POST | `/api/revit/properties/bulk` | No | JSON: `globalIds[]`, `elementIds[]`, `projectId`, `modelVersion`, `limit` | Batch fetch enriched properties with unresolved list |
| 21 | POST | `/api/revit/match-report` | No | JSON: `projectId`, `modelVersion`, `ifcElements[]` | Multi-key matching diagnostics and coverage summary |
| 22 | POST | `/api/revit/process-model` | No | multipart/form-data: `.rvt`, optional `projectId`, `modelVersion` | RVT auto-convert (feature-flag) with structured fallback |

`/api/revit/process-model` uses best-effort IFC schema request (`IFC4X3`) and falls back to converter defaults if specific schema flags are not supported by the installed converter executable.

### Response Formats

**Success responses** return JSON with relevant data fields.

**Error responses** follow a consistent format:
```json
{
  "error": "Short error title",
  "message": "Detailed error description"
}
```

**HTTP Status Codes Used:**
- `200` -- Success
- `207` -- Partial success (imported with row-level errors)
- `201` -- Created (task creation)
- `400` -- Bad request (missing required fields, unsupported file type)
- `422` -- Validation/parsing failed (no valid rows)
- `404` -- Endpoint not found
- `413` -- File too large (>500 MB)
- `500` -- Internal server error
- `503` -- Infrastructure unavailable (converter/DB/schema not ready)

### Health Endpoint Response

`GET /api/health` returns a comprehensive system status:
```json
{
  "status": "ok",
  "platform": "Jens Construction Platform",
  "version": "1.0.0",
  "timestamp": "ISO datetime",
  "uptime": 12345.678,
  "environment": {
    "nodeVersion": "v22.x.x",
    "port": 3001,
    "geminiAvailable": true
  },
  "converters": {
    "rvt": { "label": "Revit", "available": true, "path": "..." },
    "ifc": { "label": "IFC", "available": true, "path": "..." },
    "dwg": { "label": "DWG", "available": true, "path": "..." },
    "dgn": { "label": "DGN", "available": true, "path": "..." }
  },
  "cwicr": {
    "en": { "city": "Toronto", "available": true, "cached": true, "cachedRows": 55719 }
  },
  "stores": {
    "conversionHistory": 0,
    "tasks": 3,
    "documents": 4,
    "rfis": 3,
    "submittals": 3
  }
}
```

---

## Skills

The platform includes adapted DDC (Data Driven Construction) skills for AI agents, located in the `DDC_Skills_for_AI_Agents_in_Construction/` directory:

| Directory | Description |
|-----------|-------------|
| `1_DDC_Toolkit` | Core toolkit skills for CAD/BIM data processing |
| `2_DDC_Book` | Knowledge base from the Data Driven Construction guidebook |
| `3_DDC_Insights` | Analytical insights and data interpretation skills |
| `4_DDC_Curated` | Curated construction domain knowledge sets |
| `5_DDC_Innovative` | Experimental and innovative construction AI skills |

Additional documentation:
- `GETTING_STARTED.md` -- Quick start guide for skills integration
- `OPTIMIZER_GUIDE.md` -- Performance optimization guide
- `IMPROVEMENT_ROADMAP.md` -- Future development roadmap
- `ADDITIONAL_SKILLS_PROPOSAL.md` -- Proposed new skills

---

## n8n Workflows

Eight automation workflows are defined in the `cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto/` directory. The n8n instance runs at `http://localhost:5678`, managed by pm2.

### n8n_1: Simple CAD Conversion

**File:** `n8n_1_Revit_IFC_DWG_Conversation_simple.json`

Basic CAD/BIM file conversion workflow. Takes a single input file and converts it using the appropriate DDC converter executable with default settings. Suitable for quick, one-off conversions.

### n8n_2: Full Settings Conversion

**File:** `n8n_2_All_Settings_Revit_IFC_DWG_Conversation_simple.json`

Extended conversion workflow with full configuration options. Supports all converter settings including output format selection, coordinate system configuration, and element filtering. Used when precise control over conversion parameters is needed.

### n8n_3: Batch Converter Pipeline

**File:** `n8n_3_CAD-BIM-Batch-Converter-Pipeline.json`

Batch processing pipeline for converting multiple CAD/BIM files in sequence. Supports folder watching, queue management, and parallel conversion of multiple files with consolidated reporting.

### n8n_4: BIM Validation

**File:** `n8n_4_Validation_CAD_BIM_Revit_IFC_DWG.json`

Automated BIM validation workflow. Loads a requirements table from `n8n_4_DDC_BIM_Requirements_Table_for_Revit_IFC_DWG.xlsx`, runs validation checks against converted BIM data, and generates a compliance report.

### n8n_5: AI Classification with Gemini

**File:** `n8n_5_CAD_BIM_Automatic_Classification_with_LLM_and_RAG.json`

Uses LLM (Large Language Model) and RAG (Retrieval-Augmented Generation) to automatically classify BIM elements into standard construction categories. Maps elements to CWICR work item codes for cost estimation.

### n8n_6: Cost Estimation with Gemini

**File:** `n8n_6_Construction_Price_Estimation_with_LLM_for_Revt_and_IFC.json`

End-to-end cost estimation pipeline. Takes classified BIM elements, matches them against CWICR pricing data, and generates a complete cost estimate with labor, material, and equipment breakdowns.

### n8n_8: Extract Phase with Excel Parsing

**File:** `n8n_8_Revit_IFC_DWG_Conversation_EXTRACT_Phase_with_Parse_XLSX.json`

Specialized conversion workflow that extracts phase information from Revit/IFC/DWG files and parses the output Excel files for phase-specific data. Useful for construction scheduling and 4D BIM workflows.

### n8n_9: QTO HTML Report Generator

**File:** `n8n_9_CAD_BIM_Quantity_TakeOff_HTML_Report_Generator.json`

Generates formatted HTML Quantity Take-Off reports from BIM data. Produces self-contained HTML pages with styling, summary tables, category breakdowns, and element detail tables suitable for printing or sharing.

**Note:** n8n_7 (Carbon Footprint CO2 Estimator) has been removed from the active workflow set.

### Additional n8n Workflows (CWICR)

The `OpenConstructionEstimate-DDC-CWICR/` directory contains supplementary cost estimation workflows:

| File | Description |
|------|-------------|
| `n8n_1_Telegram_Bot_Cost_Estimates_and_Rate_Finder_TEXT_DDC_CWICR.json` | Telegram bot for text-based cost lookups |
| `n8n_2_Photo_Cost_Estimate_DDC_CWICR.json` | Photo-based cost estimation |
| `n8n_3_Telegram_Bot_Cost_Estimates_and_Rate_Finder_TEXT_PHOTO_PDF_DDC_CWICR.json` | Multi-format Telegram bot for cost estimation |
| `n8n_4_CAD_(BIM)_Cost_Estimation_Pipeline_4D_5D_with_DDC_CWICR.json` | Full 4D/5D cost estimation pipeline |

---

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# ── Server ──────────────────────────────────────────────
PORT=3001

# ── Google Gemini AI ────────────────────────────────────
# Required for: AI analysis, cost classification, chat, meeting minutes, QTO HTML reports
GOOGLE_API_KEY=your_google_api_key_here

# ── Telegram Bot ────────────────────────────────────────
# Required for: task notifications, project management alerts
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# ── Supabase ────────────────────────────────────────────
# Required for: persistent data storage
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here

# ── n8n Automation ──────────────────────────────────────
# Required for: workflow automation integration
N8N_URL=http://localhost:5678
```

**Variable Details:**

| Variable | Required | Used By |
|----------|----------|---------|
| `PORT` | No (default: 3001) | Express server |
| `GOOGLE_API_KEY` | Yes (for AI features) | Gemini AI integration |
| `TELEGRAM_BOT_TOKEN` | Yes (for notifications) | Telegram bot |
| `SUPABASE_URL` | Yes (for database) | Supabase client |
| `SUPABASE_ANON_KEY` | Yes (for database) | Supabase client |
| `SUPABASE_PUBLISHABLE_KEY` | Optional | Supabase client |
| `N8N_URL` | Optional | n8n workflow triggers |

**Note:** If `GOOGLE_API_KEY` is not set, the server starts successfully but all AI-dependent endpoints return a `503` status with a descriptive error message. All other modules function normally.

---

## Getting Started

### Prerequisites

- Node.js 20+ (LTS recommended)
- npm 10+
- DDC converter executables (for CAD/BIM conversion module)
- Google Cloud API key with Gemini API enabled (for AI features)
- Supabase project (for persistent storage)
- n8n instance (for automation workflows)

### Installation

1. **Install dependencies:**

```bash
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag is required due to peer dependency conflicts between React 19 and some Three.js-related packages.

2. **Create the environment file:**

Copy the environment variable template above into a `.env` file at the project root and fill in your credentials.

```bash
cp .env.example .env
# Edit .env with your values
```

3. **Start the frontend only (Vite dev server):**

```bash
npm run dev
```

Opens at `http://localhost:5173`. API calls will fail without the backend.

4. **Start the backend only (Express API server):**

```bash
npm run dev:server
```

Runs at `http://localhost:3001` with `--watch` for auto-restart on file changes.

5. **Start both frontend and backend concurrently:**

```bash
npm run dev:all
```

Uses `concurrently` to run Vite and Express in parallel. This is the recommended development command.

### Build for Production

```bash
npm run build
```

Runs TypeScript type-checking (`tsc -b`) followed by Vite production build. Output goes to `dist/`.

### Preview Production Build

```bash
npm run preview
```

Serves the `dist/` directory locally for testing the production build.

---

## Project Structure

```
revit/
|-- package.json                    # Project manifest and scripts
|-- vite.config.ts                  # Vite configuration (proxy, aliases, WASM)
|-- tsconfig.json                   # TypeScript configuration
|-- .env                            # Environment variables (not committed)
|-- index.html                      # HTML entry point
|
|-- src/
|   |-- main.tsx                    # React entry point
|   |-- App.tsx                     # Root component with routes
|   |-- vite-env.d.ts               # Vite type declarations
|   |
|   |-- components/
|   |   |-- Layout/
|   |   |   |-- Layout.tsx          # Main layout with sidebar and content area
|   |   |   |-- Sidebar.tsx         # Navigation sidebar (8 modules)
|   |   |   |-- TopBar.tsx          # Top navigation bar
|   |   |   |-- Notifications.tsx   # Toast notification system
|   |   |
|   |   |-- ui/                     # Reusable UI components
|   |   |   |-- Button.tsx
|   |   |   |-- Card.tsx
|   |   |   |-- Badge.tsx
|   |   |   |-- Table.tsx
|   |   |   |-- Tabs.tsx
|   |   |   |-- FileUpload.tsx
|   |   |
|   |   |-- Converter/
|   |   |   |-- ConverterPage.tsx   # Module 1: CAD/BIM Converter
|   |   |
|   |   |-- Viewer3D/
|   |   |   |-- ViewerPage.tsx      # Module 2: 3D IFC Viewer
|   |   |
|   |   |-- CostEstimate/
|   |   |   |-- CostEstimatePage.tsx  # Module 3: CWICR Cost Estimation
|   |   |
|   |   |-- Validation/
|   |   |   |-- ValidationPage.tsx  # Module 4: BIM Validation
|   |   |
|   |   |-- AIAnalysis/
|   |   |   |-- AIAnalysisPage.tsx  # Module 5: AI Data Analysis
|   |   |
|   |   |-- ProjectMgmt/
|   |   |   |-- ProjectMgmtPage.tsx # Module 6: Project Management
|   |   |
|   |   |-- Documents/
|   |   |   |-- DocumentsPage.tsx   # Module 7: Document Control
|   |   |
|   |   |-- QTOReports/
|   |       |-- QTOReportsPage.tsx  # Module 8: QTO Reports
|   |
|   |-- services/
|   |   |-- api.ts                  # API service layer with TypeScript interfaces
|   |
|   |-- store/
|   |   |-- appStore.ts             # Zustand global state store
|   |
|   |-- lib/
|       |-- utils.ts                # Utility functions (cn helper)
|
|-- server/
|   |-- index.js                    # Express API server (all 17 endpoints)
|
|-- public/                         # Static assets (WASM files, icons)
|
|-- cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto/
|   |-- DDC_CONVERTER_REVIT/        # Revit converter executables
|   |-- DDC_CONVERTER_IFC/          # IFC converter executables
|   |-- DDC_CONVERTER_DWG/          # DWG converter executables
|   |-- DDC_CONVERTER_DGN/          # DGN converter executables
|   |-- n8n_*.json                  # n8n workflow definitions
|   |-- Sample_Projects/            # Sample CAD/BIM files for testing
|
|-- OpenConstructionEstimate-DDC-CWICR/
|   |-- EN___DDC_CWICR/             # English CWICR data (Toronto)
|   |-- DE___DDC_CWICR/             # German CWICR data (Berlin)
|   |-- RU___DDC_CWICR/             # Russian CWICR data (St. Petersburg)
|   |-- FR___DDC_CWICR/             # French CWICR data (Paris)
|   |-- ES___DDC_CWICR/             # Spanish CWICR data (Madrid)
|   |-- AR___DDC_CWICR/             # Arabic CWICR data (Dubai)
|   |-- ZH___DDC_CWICR/             # Chinese CWICR data (Beijing)
|   |-- HI___DDC_CWICR/             # Hindi CWICR data (Delhi)
|   |-- PT___DDC_CWICR/             # Portuguese CWICR data (Sao Paulo)
|
|-- CAD-BIM-to-Code-Automation-Pipeline-DDC-Workflow-with-LLM-ChatGPT/
|   |-- DDC_Converter_Revit/        # Alternative Revit converter
|   |-- DDC_Converter_IFC/          # Alternative IFC converter
|   |-- DDC_Converter_DWG/          # Alternative DWG converter
|   |-- DDC_Converter_DGN/          # Alternative DGN converter
|
|-- DDC_Skills_for_AI_Agents_in_Construction/
|   |-- 1_DDC_Toolkit/              # Core AI agent skills
|   |-- 2_DDC_Book/                 # Construction knowledge base
|   |-- 3_DDC_Insights/             # Analytical skills
|   |-- 4_DDC_Curated/              # Curated domain knowledge
|   |-- 5_DDC_Innovative/           # Experimental skills
|
|-- Project-management-n8n-with-task-management-and-photo-reports/
|   |-- *.json                      # Project management n8n workflows
|
|-- test-data/                      # Test data files
|-- uploads/                        # Runtime file upload directory (created automatically)
|-- dist/                           # Production build output
|-- docs/                           # Documentation
```

---

## Deployment

### Production Build

```bash
npm run build
```

This produces an optimized `dist/` directory containing the static frontend assets.

### Serving in Production

1. **Frontend:** Serve the `dist/` directory with any static file server (nginx, Caddy, Cloudflare Pages, Vercel, etc.).

2. **Backend:** Run the Express server with a process manager:
   ```bash
   # Using pm2
   pm2 start server/index.js --name jens-api

   # Using Node.js directly
   NODE_ENV=production node server/index.js
   ```

3. **n8n:** Ensure the n8n instance is running and accessible at the configured `N8N_URL`.

### Environment Configuration

- Set `NODE_ENV=production` for the Express server to hide detailed error messages
- Configure a reverse proxy (nginx/Caddy) to route `/api` requests to the Express server
- Ensure all environment variables are set in the production environment
- The `uploads/` directory must be writable by the server process
- DDC converter executables must be accessible at their configured paths

### Recommended Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend static files
    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 500M;
    }

    # Uploaded files
    location /uploads/ {
        alias /path/to/uploads/;
    }
}
```

### System Requirements

- **OS:** Windows (required for DDC converter executables), Linux/macOS for non-converter features
- **Node.js:** 20.x LTS or later
- **RAM:** 2 GB minimum (4 GB recommended for large CWICR datasets)
- **Disk:** 5 GB minimum (more for uploaded files and converter outputs)
- **Network:** Outbound HTTPS access to Google Gemini API and Supabase

---

## License

MIT
