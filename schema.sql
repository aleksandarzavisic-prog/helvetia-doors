-- Helvetia Doors PWA - schema v2.6.0
-- Run this in Supabase SQL Editor BEFORE seed.sql.

drop table if exists door_signoffs cascade;
drop table if exists door_photos   cascade;
drop table if exists doors         cascade;
drop table if exists door_types    cascade;

create table door_types (
  code text primary key,
  name text not null,
  preset_width_mm     int not null,
  preset_height_mm    int not null,
  preset_thickness_mm int not null,
  tolerance_mm        int not null default 5
);

create table doors (
  id uuid primary key default gen_random_uuid(),
  qr_code text unique not null,
  floor int not null,
  floor_label text not null,
  apt_no text not null,
  room text,
  door_type text not null,
  final_width_mm     int,
  final_height_mm    int,
  final_thickness_mm int,

  status text not null default 'PENDING',
  delivered_at timestamptz,
  installed_at timestamptz,

  frame_installed       boolean not null default false,
  shutter_installed     boolean not null default false,
  architraves_installed boolean not null default false,
  hinges_installed      boolean not null default false,
  lock_handle_installed boolean not null default false,
  stopper_installed     boolean not null default false,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index doors_floor_idx  on doors(floor);
create index doors_apt_idx    on doors(apt_no);
create index doors_type_idx   on doors(door_type);
create index doors_status_idx on doors(status);

create table door_photos (
  id uuid primary key default gen_random_uuid(),
  door_id uuid not null references doors(id) on delete cascade,
  stage text not null,
  file_path text not null,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create table door_signoffs (
  id uuid primary key default gen_random_uuid(),
  door_id uuid not null references doors(id) on delete cascade,
  stage text not null,
  signer_name text not null,
  signature_image_path text,
  signed_at timestamptz not null default now()
);

alter table doors         disable row level security;
alter table door_types    disable row level security;
alter table door_photos   disable row level security;
alter table door_signoffs disable row level security;
