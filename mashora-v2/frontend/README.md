# Mashora V2 Frontend

This folder is a clean frontend workspace for the ERP, separate from the legacy Mashora webclient.

It keeps backend models, business rules, actions, sessions, and menu logic on the existing ERP server, but rebuilds the UI in React with a shadcn-style design system.

## What is included

- Dark-first premium shell with light mode support
- New login experience
- Sidebar + topbar workspace navigation
- Backend session authentication against `/web/session/*`
- Menu loading from `/web/webclient/load_menus`
- Action loading from `/web/action/load`
- Generic list, kanban, and form surfaces driven by backend view metadata
- Editable scalar form fields via existing ORM write calls

## Run it

```bash
cd mashora-v2/frontend
npm install
npm run dev
```

## Environment

- `VITE_ERP_PROXY_TARGET`
  - Optional proxy target for Vite dev server
  - Default: `http://localhost:8069`

- `VITE_ERP_BASE_URL`
  - Optional absolute ERP base URL for direct fetches
  - Leave empty in local dev so the Vite proxy handles requests

- `VITE_ERP_DATABASE`
  - Optional default database name for login

## Notes

- The backend remains the source of truth for permissions, actions, menus, and ORM behavior.
- This frontend currently focuses on the core ERP surfaces that most addons share: list, kanban, and form.
- Specialized legacy views such as graph, pivot, calendar, and report actions still need dedicated renderers if you want total feature parity.
