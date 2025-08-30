# Sourdough Orders (Next.js + Supabase + Resend)

A tiny, production-ready ordering app:
- Public **Order** page (choose items, shipping address, notes)
- **Email notification** on each order
- Simple **Admin**: login with a shared password, view/search/export orders
- **Postgres** via **Supabase**
- Deploy in ~20 minutes on **Vercel**

---

## 0) What are Vercel / Supabase / Resend?
- **Vercel**: the host where your website/app runs. Free tier is fine. https://vercel.com
- **Supabase**: a hosted Postgres database (plus dashboard and API keys). https://supabase.com
- **Resend**: a service to send transactional emails. https://resend.com

---

## 1) Local Setup (optional, but recommended)
1. Install Node.js 18+ from https://nodejs.org
2. In a terminal:
   ```bash
   npm install
   cp .env.example .env.local   # then open .env.local and fill values after steps below
   npm run dev
   ```
   Visit http://localhost:3000

---

## 2) Create a Supabase project
1. Go to https://supabase.com > Sign in > New project
2. In **Project Settings > API** copy your `Project URL` (SUPABASE_URL) and `service_role` key (SUPABASE_SERVICE_ROLE_KEY).
3. In the SQL editor, run the schema below.

### SQL Schema
```sql
create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  customer_name text not null,
  email text,
  phone text,
  ship bool not null default true,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text default 'USA',
  items jsonb not null, -- array of {sku, name, qty}
  notes text,
  status text not null default 'new'
);

-- Enable UUID extension if needed:
create extension if not exists "uuid-ossp";
```

---

## 3) Create a Resend account
1. Go to https://resend.com and create an API key (RESEND_API_KEY).
2. (Optional but recommended) Add and verify a sending domain for better deliverability.
3. Set `NEXT_PUBLIC_FROM_EMAIL` to the sender email (e.g., orders@yourdomain.com).

---

## 4) Configure environment
Open `.env.local` (or Vercel env vars later) and set:
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
NEXT_PUBLIC_FROM_EMAIL=orders@yourdomain.com
NEXT_PUBLIC_SITE_NAME=Sourdough by <Your Name>
ADMIN_PASSWORD=your-strong-password
SESSION_COOKIE_NAME=admin_session
SESSION_COOKIE_SECRET=any-random-string
```

---

## 5) Deploy to Vercel
1. Create a free account at https://vercel.com (this hosts your app).
2. Click **New Project** > **Import** from your GitHub repo (or drag-and-drop the folder).
3. In Vercel’s **Environment Variables**, add all the keys from `.env.local`.
4. Click **Deploy**.
5. After deploy, go to `/admin/login` to sign in with your admin password.

---

## 6) Using the App
- Public order form: `/order` (also the home page redirects there)
- Admin login: `/admin/login`
- Admin orders list: `/admin`
- Export CSV from the admin page

---

## Notes
- This MVP uses a simple shared admin password (stored as an env var). For stronger auth later, we can switch to Clerk, NextAuth, or Supabase Auth.
- Payments (Stripe) can be added when you’re ready.
```

