# FilamentOS - 3D Print Filament Management

## Problem Statement
Build a 3D print filament management app with inventory tracking, print job logging, low stock alerts, JWT auth, all brands/types pre-loaded, and dark/light theme toggle.

## Architecture
- **Frontend**: React 19 + Tailwind + Shadcn/UI + Recharts
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB (collections: users, filaments, print_jobs)
- **Auth**: JWT with bcrypt password hashing

## User Personas
- 3D printing hobbyists managing personal filament inventory
- Small workshop owners tracking multiple spools and print jobs
- Makers who want low-stock alerts and usage analytics

## Core Requirements
- [x] JWT-based multi-user authentication (register/login)
- [x] Filament inventory CRUD (brand, type, color, weight, cost, temps, dates)
- [x] Print job logging with automatic filament weight deduction
- [x] Dashboard with stats, charts (usage by type, distribution), recent prints
- [x] Low stock alerts (critical <10%, warning <20%, low <30%)
- [x] Dark/light theme toggle
- [x] Pre-loaded brands (21) and filament types (21)
- [x] Filtering/searching filaments by type, brand, text
- [x] Calendar date picker for purchase dates
- [x] Responsive design with mobile sidebar

## What's Been Implemented (Feb 2026)
- Full backend API: auth, filaments CRUD, print jobs, dashboard stats, alerts, reference data
- Complete frontend: Login, Dashboard, Filaments, Print Jobs, Alerts pages
- Design: JetBrains Mono + Manrope fonts, orange primary (#f97316), grid borders aesthetic
- All tests passing (Backend 13/13, Frontend 95%)

### Phase 3 Features (Feb 2026)
- Printer master CRUD (name, model, build volume, notes) with dedicated /printers page
- Edit print jobs (update status, printer, duration, project name, notes)
- Print job status: Finished/Failed/In Progress/Cancelled with color-coded badges
- Printer selection when logging print jobs (stored denormalized as printer_name)
- Permanent custom brands/types (custom_brands, custom_types MongoDB collections)
- Custom options saved on add via CreatableCombobox with onCustomAdd callback
- All tests passing (Backend 18/18, Frontend 95%)

## Prioritized Backlog
### P0 (Done)
- Auth, Filaments CRUD, Print Jobs, Dashboard, Alerts, Theme toggle

### P1
- Filament photo uploads
- Print job image attachments (before/after photos)
- Multi-printer support
- Filament usage cost tracking per print

### P2
- Filament price comparison
- Reorder links to Amazon/supplier URLs
- Print success rate analytics
- Filament drying time tracker
- Spool weight history graph
