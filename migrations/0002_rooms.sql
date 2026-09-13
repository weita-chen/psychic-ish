-- Unowned room state for Psychic-ish. Access is via room code + player token,
-- not user accounts. Tokens live in this table and are never returned except
-- to the joining player.

create table if not exists rooms (
  room_code text primary key,
  host_player_id text not null,
  state jsonb not null,
  tokens jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  last_activity timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists rooms_last_activity_idx on rooms (last_activity);
