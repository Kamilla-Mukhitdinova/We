# Bismillah Planner

A personal planner for tasks, wishes, and family notes with local-first storage, built with React, TypeScript, and Tailwind CSS.

## Features

- Task management with categories, deadlines, and status tracking
- Wish board with Pinterest-style layout
- Daily wishes and Hadith of the day
- Progress tracking per user
- Local browser storage by default, so the app works from a GitHub deploy without a database
- Dark/Light mode
- Kazakh ethno-inspired design

## Tech Stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Framer Motion

## Getting Started

```bash
npm install
npm run dev
```

## Storage

By default, the app stores data locally in the browser (`localStorage`). That means a static deployment from GitHub works without configuring any external database.

If you later want sync between devices, you can still enable the optional Supabase mode via `VITE_STORAGE_MODE=shared` and the related env variables described in [SUPABASE_SETUP.md](/Users/kamilla/Desktop/We/SUPABASE_SETUP.md).
