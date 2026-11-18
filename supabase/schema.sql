-- ============================================================
-- GrailJobs – Supabase Schema
-- Run this ONCE in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 1. USERS  (mirrors UserProfile from src/types/index.ts)
-- ─────────────────────────────────────────────────────────────
create table if not exists users (
  id                  text primary key,
  email               text unique not null,
  full_name           text,
  avatar_url          text,
  headline            text,
  phone               text,
  location            text,
  country             text,
  professional_summary text,
  years_of_experience text,
  work_experience     text,
  portfolio_url       text,
  linkedin_url        text,
  role                text not null default 'user', -- user | admin | super_admin
  account_status      text not null default 'active', -- active | suspended | pending_deletion
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. COMPANIES
-- ─────────────────────────────────────────────────────────────
create table if not exists companies (
  id            text primary key,
  name          text not null,
  slug          text unique not null,
  logo_url      text,
  cover_url     text,
  description   text,
  website       text,
  industry      text,
  company_size  text,
  headquarters  text,
  country       text,
  city          text,
  social_links  jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 3. CATEGORIES
-- ─────────────────────────────────────────────────────────────
create table if not exists categories (
  id          text primary key,
  name        text not null,
  slug        text unique not null,
  description text,
  icon        text,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 4. SKILLS
-- ─────────────────────────────────────────────────────────────
create table if not exists skills (
  id         text primary key,
  name       text not null,
  slug       text unique not null,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 5. JOBS
-- ─────────────────────────────────────────────────────────────
create table if not exists jobs (
  id                       text primary key,
  title                    text not null,
  slug                     text unique not null,
  company_id               text references companies(id) on delete set null,
  category_id              text references categories(id) on delete set null,
  description              text,
  responsibilities         jsonb,  -- string[]
  requirements             jsonb,  -- string[]
  qualifications           jsonb,  -- string[]
  benefits                 jsonb,  -- string[]
  location                 text,
  city                     text,
  country                  text,
  workplace_type           text,   -- remote | hybrid | on-site
  employment_type          text,   -- full-time | part-time | contract | freelance | internship
  experience_level         text,   -- freshers | entry | mid | senior | lead | executive
  salary_min               numeric,
  salary_max               numeric,
  salary_currency          text default 'USD',
  salary_period            text,   -- hourly | monthly | yearly
  salary_visible           boolean default true,
  application_mode         text,   -- internal | external
  external_application_url text,
  application_deadline     timestamptz,
  source                   text default 'manual',
  external_job_id          text,
  imported_at              timestamptz,
  closed_at                timestamptz,
  status                   text not null default 'draft', -- draft | published | expired | filled | archived
  is_featured              boolean default false,
  promotion_status         text default 'inactive',       -- active | inactive
  published_at             timestamptz,
  created_by               text references users(id) on delete set null,
  skills                   jsonb,  -- string[]
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 6. RESUMES
-- ─────────────────────────────────────────────────────────────
create table if not exists resumes (
  id           text primary key,
  user_id      text not null references users(id) on delete cascade,
  file_name    text,
  storage_path text,
  file_size    bigint,
  mime_type    text,
  is_default   boolean default false,
  data_url     text,
  created_at   timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 7. APPLICATIONS
-- ─────────────────────────────────────────────────────────────
create table if not exists applications (
  id           text primary key,
  job_id       text not null references jobs(id) on delete cascade,
  user_id      text not null references users(id) on delete cascade,
  resume_id    text references resumes(id) on delete set null,
  cover_letter text,
  status       text not null default 'submitted',
  applied_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table if not exists application_status_history (
  id               text primary key,
  application_id   text not null references applications(id) on delete cascade,
  previous_status  text,
  new_status       text not null,
  changed_by       text references users(id) on delete set null,
  changed_by_name  text,
  admin_note       text,
  created_at       timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 8. SAVED JOBS
-- ─────────────────────────────────────────────────────────────
create table if not exists saved_jobs (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  job_id     text not null references jobs(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, job_id)
);

-- ─────────────────────────────────────────────────────────────
-- 9. CONTACT MESSAGES
-- ─────────────────────────────────────────────────────────────
create table if not exists contact_messages (
  id         text primary key,
  name       text,
  email      text,
  subject    text,
  message    text,
  status     text default 'unread', -- unread | read | resolved
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 10. NEWSLETTER SUBSCRIBERS
-- ─────────────────────────────────────────────────────────────
create table if not exists newsletter_subscribers (
  id            text primary key,
  email         text unique not null,
  status        text default 'active', -- active | unsubscribed
  subscribed_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 11. SITE SETTINGS
-- ─────────────────────────────────────────────────────────────
create table if not exists site_settings (
  id              text primary key default 'default',
  site_name       text,
  hero_headline   text,
  hero_subtitle   text,
  seo_title       text,
  seo_description text,
  contact_email   text,
  twitter_url     text,
  github_url      text,
  linkedin_url    text,
  footer_text     text,
  updated_at      timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 12. PRICING PACKAGES
-- ─────────────────────────────────────────────────────────────
create table if not exists pricing_packages (
  id          text primary key,
  name        text not null,
  price       numeric not null,
  currency    text default 'USD',
  duration_days int,
  description text,
  features    jsonb,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 13. PAYMENT ORDERS
-- ─────────────────────────────────────────────────────────────
create table if not exists payment_orders (
  id                text primary key,
  job_id            text references jobs(id) on delete set null,
  user_id           text references users(id) on delete set null,
  package_id        text references pricing_packages(id) on delete set null,
  amount            numeric not null,
  currency          text default 'USD',
  status            text default 'pending', -- pending | completed | failed | refunded
  payment_provider  text,
  provider_order_id text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 14. JOB PROMOTIONS
-- ─────────────────────────────────────────────────────────────
create table if not exists job_promotions (
  id          text primary key,
  job_id      text not null references jobs(id) on delete cascade,
  order_id    text references payment_orders(id) on delete set null,
  status      text default 'active', -- active | expired | cancelled
  starts_at   timestamptz default now(),
  expires_at  timestamptz,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 15. INDEXES (for performance)
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_jobs_status         on jobs(status);
create index if not exists idx_jobs_company_id     on jobs(company_id);
create index if not exists idx_jobs_category_id    on jobs(category_id);
create index if not exists idx_jobs_is_featured    on jobs(is_featured);
create index if not exists idx_applications_job_id on applications(job_id);
create index if not exists idx_applications_user_id on applications(user_id);
create index if not exists idx_saved_jobs_user_id  on saved_jobs(user_id);
create index if not exists idx_job_promotions_job_id on job_promotions(job_id);

-- ─────────────────────────────────────────────────────────────
-- 16. ROW LEVEL SECURITY (basic setup)
-- ─────────────────────────────────────────────────────────────
-- Enable RLS (we use service_role key on backend so this is a safety net)
alter table users                   enable row level security;
alter table companies               enable row level security;
alter table categories              enable row level security;
alter table skills                  enable row level security;
alter table jobs                    enable row level security;
alter table resumes                 enable row level security;
alter table applications            enable row level security;
alter table saved_jobs              enable row level security;
alter table contact_messages        enable row level security;
alter table newsletter_subscribers  enable row level security;
alter table site_settings           enable row level security;
alter table pricing_packages        enable row level security;
alter table payment_orders          enable row level security;
alter table job_promotions          enable row level security;

-- Public read policies
create policy "Public can read published jobs"    on jobs            for select using (status = 'published');
create policy "Public can read companies"         on companies       for select using (true);
create policy "Public can read categories"        on categories      for select using (true);
create policy "Public can read skills"            on skills          for select using (true);
create policy "Public can read pricing packages"  on pricing_packages for select using (is_active = true);

-- Users can manage their own data
create policy "Users can read own profile"        on users           for select using (auth.uid()::text = id);
create policy "Users can update own profile"      on users           for update using (auth.uid()::text = id);
create policy "Users can read own applications"   on applications    for select using (auth.uid()::text = user_id);
create policy "Users can create applications"     on applications    for insert with check (auth.uid()::text = user_id);
create policy "Users can read own saved jobs"     on saved_jobs      for select using (auth.uid()::text = user_id);
create policy "Users can manage own saved jobs"   on saved_jobs      for all    using (auth.uid()::text = user_id);
create policy "Users can read own resumes"        on resumes         for select using (auth.uid()::text = user_id);
create policy "Users can manage own resumes"      on resumes         for all    using (auth.uid()::text = user_id);

-- Service role key bypasses RLS entirely (backend migration/admin use)
