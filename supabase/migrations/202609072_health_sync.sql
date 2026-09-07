-- Apple Watch (via the user's own "Duffy" app) step/distance sync.
-- Applies once on top of 202609070001_initial.sql. Health totals never affect
-- verification, rankings, team distance or challenge entries: those still
-- come only from public.runs via the existing guard_run/recompute_entries triggers.
begin;
create extension if not exists pgcrypto with schema extensions;

create table public.health_sync_tokens(
 user_id uuid primary key references auth.users(id) on delete cascade,
 token_hash text not null,
 created_at timestamptz not null default now(),
 last_used_at timestamptz
);
create table public.health_daily_totals(
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null,
 steps integer not null default 0 check(steps between 0 and 200000),
 distance_m integer not null default 0 check(distance_m between 0 and 500000),
 source text not null default 'duffy' check(source='duffy'),
 updated_at timestamptz not null default now(),
 primary key(user_id,day)
);
alter table public.health_sync_tokens enable row level security;
alter table public.health_daily_totals enable row level security;
-- No policies on health_sync_tokens: the token itself is never readable, only
-- rotated or revoked, through the security-definer functions below.
create policy own_health_read on public.health_daily_totals for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.health_sync_tokens,public.health_daily_totals from anon,authenticated;
grant select on public.health_daily_totals to authenticated;

-- Issues a new opaque token for the signed-in user and returns it once.
-- Only its SHA-256 hash is stored; losing the returned value means rotating again.
create function public.rotate_health_sync_token() returns text language plpgsql security definer set search_path='' as $$
declare token text;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 token:=encode(extensions.gen_random_bytes(24),'base64');
 insert into public.health_sync_tokens(user_id,token_hash,created_at,last_used_at) values(auth.uid(),encode(extensions.digest(token,'sha256'),'hex'),now(),null)
 on conflict(user_id) do update set token_hash=excluded.token_hash,created_at=now(),last_used_at=null;
 return token;
end $$;
create function public.revoke_health_sync_token() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 delete from public.health_sync_tokens where user_id=auth.uid();
end $$;
create function public.health_sync_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('connected',exists(select 1 from public.health_sync_tokens where user_id=auth.uid()));
$$;
-- Called by Duffy over HTTPS with only the opaque token, so it runs as anon.
-- The token is a 192-bit secret; treat it like a password. One row per user per day.
create function public.sync_health(p_token text,p_day date,p_steps integer,p_distance_m integer) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid;begin
 if p_token is null or length(p_token)<20 then raise exception 'Invalid token';end if;
 if p_day is null or p_day>current_date or p_day<current_date-interval '90 days' then raise exception 'Invalid day';end if;
 select user_id into uid from public.health_sync_tokens where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if uid is null then raise exception 'Invalid token';end if;
 update public.health_sync_tokens set last_used_at=now() where user_id=uid;
 insert into public.health_daily_totals(user_id,day,steps,distance_m,source,updated_at) values(uid,p_day,greatest(0,coalesce(p_steps,0)),greatest(0,coalesce(p_distance_m,0)),'duffy',now())
 on conflict(user_id,day) do update set steps=excluded.steps,distance_m=excluded.distance_m,updated_at=now();
end $$;
revoke all on function public.rotate_health_sync_token(),public.revoke_health_sync_token(),public.health_sync_status(),public.sync_health(text,date,integer,integer) from public,anon,authenticated;
grant execute on function public.rotate_health_sync_token(),public.revoke_health_sync_token(),public.health_sync_status() to authenticated;
grant execute on function public.sync_health(text,date,integer,integer) to anon;
commit;
