-- Push notification subscriptions
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  subscription jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions(user_id);

-- RLS
alter table push_subscriptions enable row level security;

create policy "Users manage own subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id);
