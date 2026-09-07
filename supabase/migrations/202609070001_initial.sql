-- Apply once to a fresh Supabase project. Public app keys are safe only with these RLS rules.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null default 'Runner' check(length(nickname) between 1 and 40),
 country text not null default 'jp' check(country in ('jp','us','sg','kr')),
 unit text not null default 'km' check(unit in ('km','mile')),
 consents jsonb not null default '{"analysis":false,"ranking":false,"research":false,"marketing":false}'::jsonb,
 created_at timestamptz not null default now()
);
create table public.teams(id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 40), created_at timestamptz not null default now());
create unique index teams_name_unique on public.teams(lower(name));
create table public.team_members(user_id uuid primary key references auth.users(id) on delete cascade, team_id uuid not null references public.teams(id) on delete cascade, joined_at timestamptz not null default now());
create table public.runs(
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 team_id uuid references public.teams(id) on delete set null,
 started_at timestamptz not null,
 duration_seconds integer not null check(duration_seconds between 0 and 604800),
 distance_m integer not null check(distance_m between 0 and 1000000),
 points jsonb not null default '[]' check(jsonb_typeof(points)='array' and jsonb_array_length(points)<=100000),
 splits jsonb not null default '[]' check(jsonb_typeof(splits)='array'),
 rejected_points integer not null default 0 check(rejected_points>=0),
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
 created_at timestamptz not null default now()
);
create index runs_user_date on public.runs(user_id,started_at desc);
create index runs_verified_date on public.runs(started_at) where verification_status='verified';
create table public.challenges(id uuid primary key default gen_random_uuid(),title text not null, starts_on date not null, ends_on date not null, draw_on date, min_distance_m integer not null default 2000 check(min_distance_m>0),max_entries integer not null default 10 check(max_entries>0),check(ends_on>=starts_on));
create table public.challenge_participants(challenge_id uuid references public.challenges(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,joined_at timestamptz not null default now(),primary key(challenge_id,user_id));
create table public.challenge_entries(challenge_id uuid references public.challenges(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,run_day date not null,primary key(challenge_id,user_id,run_day));
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.runs enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.challenge_entries enable row level security;
create policy own_profile on public.profiles for all to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy own_runs on public.runs for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_membership_read on public.team_members for select to authenticated using(user_id=(select auth.uid()));
create policy own_membership_delete on public.team_members for delete to authenticated using(user_id=(select auth.uid()));
create policy challenges_read on public.challenges for select to authenticated using(true);
create policy participation_read on public.challenge_participants for select to authenticated using(user_id=(select auth.uid()));
create policy participation_insert on public.challenge_participants for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.challenges c where c.id=challenge_id and (now() at time zone 'UTC')::date between c.starts_on and c.ends_on));
create policy participation_update on public.challenge_participants for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_entries_read on public.challenge_entries for select to authenticated using(user_id=(select auth.uid()));
-- No client can write verification, team association, challenge entries, or membership timestamps.
create function public.guard_run() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.role()='authenticated' then
  if new.verification_status<>'pending' or (tg_op='UPDATE' and old.verification_status<>'pending') then raise exception 'Verification is server managed';end if;
  if new.started_at>now()+interval '5 minutes' then raise exception 'Future run not allowed';end if;
  if tg_op='INSERT' then
   select m.team_id into new.team_id from public.team_members m where m.user_id=auth.uid();
   new.created_at:=now();
  else
   new.team_id:=old.team_id;new.created_at:=old.created_at;
  end if;
 end if;
 return new;
end $$;
create trigger guard_run before insert or update on public.runs for each row execute function public.guard_run();
-- Recompute entries under a per-user lock. Multiple runs on a UTC day still give only one entry.
create function public.recompute_entries() returns trigger language plpgsql security definer set search_path='' as $$
declare uid uuid;begin
 if tg_op='DELETE' then uid:=old.user_id;else uid:=new.user_id;end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 delete from public.challenge_entries where user_id=uid;
 insert into public.challenge_entries(challenge_id,user_id,run_day)
 select challenge_id,uid,run_day from (
  select c.id challenge_id,(r.started_at at time zone 'UTC')::date run_day,c.max_entries,
   row_number() over(partition by c.id order by (r.started_at at time zone 'UTC')::date) rn
  from public.runs r join public.challenge_participants p on p.user_id=r.user_id
  join public.challenges c on c.id=p.challenge_id
  where r.user_id=uid and r.verification_status='verified' and r.distance_m>=c.min_distance_m
  and r.started_at>=p.joined_at and (r.started_at at time zone 'UTC')::date between c.starts_on and c.ends_on
  group by c.id,(r.started_at at time zone 'UTC')::date,c.max_entries
 ) eligible where rn<=max_entries;
 return null;
end $$;
create trigger run_entries after insert or update or delete on public.runs for each row execute function public.recompute_entries();
create function public.join_team(p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare tid uuid;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if length(trim(p_name)) not between 1 and 40 then raise exception 'Team name must be 1-40 characters';end if;
 if exists(select 1 from public.team_members where user_id=auth.uid()) then raise exception 'Leave your current team first';end if;
 insert into public.teams(name) values(trim(p_name)) on conflict (lower(name)) do nothing;
 select id into tid from public.teams where lower(name)=lower(trim(p_name));
 insert into public.team_members(user_id,team_id) values(auth.uid(),tid);
 return tid;
end $$;
create function public.get_my_team() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',t.id,'name',t.name,
 'distance_km',(select coalesce(sum(r.distance_m),0)/1000.0 from public.runs r where r.team_id=t.id and r.verification_status='verified' and r.started_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),
 'total_km',(select coalesce(sum(r.distance_m),0)/1000.0 from public.runs r where r.team_id=t.id and r.verification_status='verified'),
 'members',(select coalesce(jsonb_agg(jsonb_build_object('nickname',coalesce(p.nickname,'Runner'),'distance_km',coalesce(d.meters,0)/1000.0)),'[]')
 from public.team_members m left join public.profiles p on p.id=m.user_id
 left join lateral(select sum(r.distance_m) meters from public.runs r where r.team_id=t.id and r.user_id=m.user_id and r.verification_status='verified' and r.started_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC') d on true
 where m.team_id=t.id))
 from public.teams t join public.team_members me on me.team_id=t.id where me.user_id=auth.uid();
$$;
create function public.get_rankings(p_period text default 'month',p_country text default null,p_type text default 'individual') returns table(name text,distance_km numeric) language sql stable security definer set search_path='' as $$
 with eligible as (
 select r.*,p.nickname,p.country from public.runs r join public.profiles p on p.id=r.user_id
 where auth.uid() is not null and r.verification_status='verified' and p.consents->>'ranking'='true'
 and (p_country is null or p.country=p_country)
 and (p_period='all' or r.started_at>=date_trunc(case when p_period='week' then 'week' else 'month' end,now() at time zone 'UTC') at time zone 'UTC')
 )
 select x.name,x.distance_km from (
 select e.nickname as name,sum(e.distance_m)/1000.0 as distance_km from eligible e where p_type='individual' group by e.user_id,e.nickname
 union all
 select t.name,sum(e.distance_m)/1000.0 from eligible e join public.teams t on t.id=e.team_id where p_type='team' group by t.id,t.name
 ) x order by x.distance_km desc,x.name limit 100;
$$;
create function public.delete_my_app_data() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 delete from public.challenge_participants where user_id=auth.uid();
 delete from public.challenge_entries where user_id=auth.uid();
 delete from public.runs where user_id=auth.uid();
 delete from public.team_members where user_id=auth.uid();
 delete from public.profiles where id=auth.uid();
end $$;
revoke all on public.profiles,public.runs,public.teams,public.team_members,public.challenges,public.challenge_participants,public.challenge_entries from anon,authenticated;
grant select,insert,update,delete on public.profiles,public.runs to authenticated;
grant select,delete on public.team_members to authenticated;
grant select on public.challenges,public.challenge_entries to authenticated;
grant select,insert on public.challenge_participants to authenticated;
grant update(challenge_id,user_id) on public.challenge_participants to authenticated;
revoke all on function public.guard_run(),public.recompute_entries(),public.join_team(text),public.get_my_team(),public.get_rankings(text,text,text),public.delete_my_app_data() from public,anon,authenticated;
grant execute on function public.join_team(text),public.get_my_team(),public.get_rankings(text,text,text),public.delete_my_app_data() to authenticated;
commit;
