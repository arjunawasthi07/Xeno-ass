# Xeno AI-Native Mini CRM & Channel Service Simulator

A complete, live-simulated marketing CRM and message gateway simulator designed for retail and D2C brands. Built to demonstrate intelligent natural language segmentation, AI campaign writing, performance auditing, and highly robust queue management (reliable callbacks with exponential backoff).

---

## 1. Directory Structure & Decoupled Architecture

The project is structured as a clean monorepo where all `node_modules` are localized inside their respective service folders:

```
xeno-ai-crm/ (Project Root)
  ├── README.md (This file)
  │
  ├── crm-backend/             # Port 3000 (CRM Backend)
  │     ├── db.js              # Database Seeding & Segmentation Query Builder
  │     ├── ai.js              # Gemini 3.5 Flash SDK Integration & Mocks
  │     ├── server.js          # Express API, batch dispatches, state comparator
  │     └── package.json
  │
  ├── channel-service/         # Port 3001 (Simulator Service)
  │     ├── db.js              # Simulator outbox and callback retry tables
  │     ├── server.js          # Asynchronous simulation engine & retry worker
  │     └── package.json
  │
  └── frontend/                # Port 5173 (React Frontend)
        ├── src/
        │    ├── main.jsx
        │    ├── App.jsx       # View controller & layout
        │    ├── index.css     # CSS Variables, grid reset, minimal styling
        │    ├── utils/
        │    │    └── api.js   # Centralized HTTP request utility
        │    └── components/
        │         ├── Dashboard.jsx        # KPIs, simulator config, live stream terminal
        │         ├── Shoppers.jsx         # Shopper tables, AI Segment Builder drawer
        │         ├── Campaigns.jsx        # Outbox logs, AI Writer wizard, AI Auditor card
        │         └── AICopilot.jsx        # AI agent chat panel with one-click deployers
        └── package.json
```

---

## 2. Core Technical Specifications

### Tech Stack Choices
* **Frontend**: Vite + React + Vanilla CSS (Light theme, grid-based layouts, ample white space, sharp 90-degree corners, and clean border separator lines).
* **CRM Backend**: Node.js + Express.
* **Simulator Backend**: Node.js + Express.
* **Databases**: SQLite (default, zero configuration required) or PostgreSQL (optional, configuration available via environment variables) managed via Knex.
* **AI Provider**: Google Gemini API via the official `@google/genai` SDK (uses `gemini-2.5-flash`). Features a **robust heuristic mock mode** if no API key is present, ensuring immediate functionality.

### Cross-Platform Support (macOS, Linux, Windows)
The codebase has been engineered to run natively on **Windows** as well as macOS and Linux:
1. **Path Normalization**: Node `path.join` is used exclusively for file system paths, handling dynamic separator slashes (`\` on Windows, `/` on Unix) automatically.
2. **Precompiled SQLite**: Uses standard `sqlite3` which installs precompiled platform binaries, avoiding Windows C++ compilation errors.
3. **Pure-JS Postgres Driver**: Uses the pure-JavaScript PostgreSQL client (`pg`) instead of native C bindings, ensuring clean out-of-the-box Windows connectivity.
4. **Cross-Platform Script Runner**: Orchestrated via `concurrently` to launch multi-service processes on any shell environment (PowerShell, CMD, Bash, zsh).

---

## 3. Resolving the Channel Design Challenges

### 1. Volume (Throttling & Batching)
When launching a campaign, the CRM queries the segment, inserts individual message records, and dispatches the payload as a single, compressed JSON batch payload (`POST /api/send-batch`) to the Channel Service. The simulator outbox enqueues these database records in a single transactional query and launches asynchronous timeouts to process transitions, preventing thread-blocking loops.

### 2. Out-of-Order Callbacks (State Machine Protection)
Message events can arrive out of order (e.g. "Read" callback gets processed before "Delivered"). To prevent data corruption, the CRM employs a **Progressive State Comparator**:
$$\text{sent} (0) \rightarrow \text{delivered/failed} (1) \rightarrow \text{opened/read} (2) \rightarrow \text{clicked} (3) \rightarrow \text{converted} (4)$$
When a callback arrives, the CRM verifies if the new state has a higher weight than the current state in the database. If a "Delivered" callback arrives for a message already marked "Read" (weight $1 < 2$), the status transition is safely ignored.

### 3. Failures & Retries (Exponential Backoff Callback Queue)
The Channel Service logs all callbacks to a database-backed `callbacks_queue` table. A background worker inspects this queue every 2 seconds:
* If the CRM callback API returns a failure (e.g., HTTP 500 or 429), the worker increments the callback's `retry_count`.
* The next attempt time is scheduled using **exponential backoff**:
  $$\text{Delay} = 2^{\text{retry\_count}} \times 2 \text{ seconds}$$
* Up to 5 retry attempts are made before the callback is moved to a dead-letter state.

*Note: You can easily test this retry queue by toggling "Inject CRM Server Errors" or "Inject CRM Rate Limits" directly in the Dashboard UI. You will instantly see the retry backoff schedule log live in the console and simulator status panel.*

### 4. Attributed Conversions
When a simulation transitions to `converted`, the Channel Service generates a mock shopper order (matching catalog items like apparel or coffee) and inserts it back into the CRM (`POST /api/orders/ingest`). It then updates the campaign's total attributed revenue, closing the full campaign loop.

---

## 4. How to Run Locally

### Step 1: Install Dependencies
Inside each project directory:
```bash
# Install CRM Backend dependencies
cd crm-backend && npm install

# Install Channel Service dependencies
cd ../channel-service && npm install

# Install Frontend dependencies
cd ../frontend && npm install
```

### Step 2: Configure AI & Database Connections (Optional)

1. **AI API Key**: To use real Gemini models, create a `.env` file inside `crm-backend/` and add your API key:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   ```
   *If left blank, the CRM automatically runs in Mock AI mode, generating realistic segment queries and campaign copies using local string-parsing heuristics.*

2. **Database Selection (SQLite by Default, PostgreSQL Optional)**:
   By default, both services run on local **SQLite** database files (`crm.db` and `simulator.db`) requiring zero configuration. 
   
   To switch to **PostgreSQL**, simply define database credentials in your `.env` files inside `crm-backend/` and `channel-service/` folders:
   ```env
   DB_CLIENT=pg
   PG_HOST=localhost
   PG_PORT=5432
   PG_USER=postgres
   PG_PASSWORD=your_postgres_password
   PG_DATABASE=xeno_crm
   PG_SIMULATOR_DATABASE=xeno_simulator
   ```
   *The CRM and Simulator services will automatically connect to your PostgreSQL server, create the databases `xeno_crm` and `xeno_simulator` if they do not already exist, initialize all tables, and seed the mock customer and purchase order histories on boot.*

### Step 3: Run the Services
We've set up a concurrent script in the `crm-backend` folder. You can run all three services in parallel with a single command:
```bash
cd crm-backend
npm run start-all
```
This concurrently spins up:
1. **CRM Backend** on `http://localhost:3000`
2. **Channel Simulator** on `http://localhost:3001`
3. **Vite Frontend Dev Server** on `http://localhost:5173`

Open `http://localhost:5173` in your browser to explore the dashboard, segment customers, and launch campaigns.
