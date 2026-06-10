# Xeno CRM Frontend (Vite + React Client)

A React Single Page Application (SPA) designed as the user interface for the AI-Native Mini CRM, styled using minimalist, high-whitespace Vanilla CSS.

---

## 1. Directory Structure

```
frontend/
  ├── public/                  # Static assets (Favicons, Icons)
  ├── src/
  │    ├── assets/             # Brand logos (XenoLogo.jpeg)
  │    ├── components/
  │    │    ├── Dashboard.jsx  # KPIs, simulator logs terminal, queue metrics
  │    │    ├── Shoppers.jsx   # Shopper list and NL segment drawer
  │    │    ├── Campaigns.jsx  # Campaign overview, outbox tables, AI reviews
  │    │    └── AICopilot.jsx  # Copilot chat console with one-click deployments
  │    ├── utils/
  │    │    └── api.js         # Centralized CRM and Simulator API client
  │    ├── App.jsx             # Sidebar navigation and view controller
  │    └── index.css           # CSS variables, typography, grids, tag styles
  ├── index.html
  ├── vite.config.js
  └── package.json
```

---

## 2. Minimalist Design System (Vanilla CSS)

The frontend is styled using pure CSS variables defined in `src/index.css`:
* **Aesthetic**: Light-mode first with high typographic contrast and breathing whitespace.
* **Palette**: Monochromatic shades of grays, blacks, and whites, accented with cobalt blue (`#3b82f6`) for active visual triggers and button states.
* **Subtle Radii**: Uses a uniform `4px` border-radius across inputs, cards, tags, and buttons to soften borders while maintaining a clean grid structure.
* **High Contrast Navigation**: Active navigation sidebar items highlight with a clean, rounded off-white background with zero side borders, minimizing visual clutter.

---

## 3. Running Separately

While the entire stack (CRM, Simulator, and Frontend) is typically launched using the unified runner inside the `crm-backend` folder, you can run the dev server independently:

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the local Vite dev server**:
   ```bash
   npm run dev
   ```
   The client will boot at `http://localhost:5173`.

3. **Compile for production**:
   ```bash
   npm run build
   ```
   Vite compiles static HTML, CSS, and JS chunks into the `/dist` directory.
