# FinTrack — Full-Stack Personal Finance App

A portfolio-ready finance dashboard with authentication, user-specific data, budgets, reports and a PostgreSQL API.

## Stack

- Frontend: React + Vite + Lucide
- Backend: Node.js + Express
- Database: PostgreSQL
- Authentication: JWT + bcrypt
- Frontend deployment: Vercel
- Backend deployment: Render/Railway/etc.
- Database: Neon/Supabase PostgreSQL

## Features

### Authentication
- Create account
- Login
- Logout
- Protected dashboard
- JWT session
- Password hashing with bcrypt
- Each account can only access its own transactions and budgets

### Finance
- Add transaction
- Delete transaction
- Income/expense totals
- Live balance
- Search and filters
- Category budgets
- Budget progress and over-budget state
- Reports
- Spending by category
- CSV export
- Responsive mobile UI

## Run locally

### 1. Create PostgreSQL database

Create a free PostgreSQL database with Neon or Supabase and copy its connection string.

### 2. Start API

```bash
cd server
npm install
```

Create `server/.env`:

```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=replace_with_a_long_random_secret
CORS_ORIGIN=http://localhost:5173
PORT=5000
```

Then:

```bash
npm run dev
```

The API runs at `http://localhost:5000`.

The server automatically creates the required tables on startup.

### 3. Start frontend

From the project root:

```bash
npm install
npm run dev
```

The frontend runs at the Vite URL, normally `http://localhost:5173`.

For a different API URL create `.env` in the project root:

```env
VITE_API_URL=http://localhost:5000/api
```

## Deployment

### Backend

Deploy the `server` folder to a Node-compatible host.

Set:

```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=long_random_secret
CORS_ORIGIN=https://your-vercel-domain.vercel.app
PORT=10000
```

Use:

```bash
npm start
```

as the start command.

### Frontend

Deploy the project root to Vercel.

Set:

```env
VITE_API_URL=https://your-backend-domain.com/api
```

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

## Important

Do not commit `.env` files or passwords to GitHub.

This version intentionally does not include email-based password reset because that requires an email provider and additional secret configuration. Login/signup and secure password hashing are included.
