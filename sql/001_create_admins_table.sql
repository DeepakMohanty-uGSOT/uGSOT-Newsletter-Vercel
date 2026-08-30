-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- before deploying the multi-admin auth feature.
create table if not exists admins (
  id serial primary key,
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin' check (role in ('super_admin', 'admin')),
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  created_by integer,
  created_at timestamptz not null default now()
);
