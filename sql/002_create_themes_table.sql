-- Run this once in the Supabase SQL editor before deploying the email
-- theme customization feature.

create table if not exists themes (
  id serial primary key,
  name text not null unique,
  header_gradient_start text not null,
  header_gradient_end text not null,
  accent_color text not null,
  footer_color text not null,
  banner_emoji text,
  greeting_text text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table newsletters
  add column if not exists theme_id integer references themes(id) on delete set null;

-- Seed a "Default" theme matching the colors the app already hard-codes
-- today, and mark it active, so nothing visually changes until you create
-- and activate a new one from the Themes page.
insert into themes (name, header_gradient_start, header_gradient_end, accent_color, footer_color, is_active)
values ('Default', '#c8102e', '#e63946', '#c8102e', '#c8102e', true)
on conflict (name) do nothing;
