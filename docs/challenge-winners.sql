-- Apply after the initial schema. No actual winners are seeded.
create table public.challenge_winners (
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null references public.challenges(id) on delete cascade,
 nickname text not null check(length(trim(nickname)) between 1 and 40),
 challenge_month date not null,
 challenge_title text not null check(length(challenge_title) between 1 and 160),
 published_at timestamptz
);
alter table public.challenge_winners enable row level security;
create policy published_winners on public.challenge_winners for select to anon, authenticated using(published_at is not null and published_at <= now());
grant select on public.challenge_winners to anon, authenticated;
revoke insert,update,delete on public.challenge_winners from anon,authenticated;
create index challenge_winners_challenge on public.challenge_winners(challenge_id);
