-- Extend team summaries; existing verification and ranking rules stay intact.
create or replace function public.get_my_team() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',t.id,'name',t.name,
 'distance_km',(select coalesce(sum(r.distance_m),0)/1000.0 from public.runs r where r.team_id=t.id and r.verification_status='verified' and r.started_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),
 'total_km',(select coalesce(sum(r.distance_m),0)/1000.0 from public.runs r where r.team_id=t.id and r.verification_status='verified'),
 'recorded_distance_km',(select coalesce(sum(r.distance_m),0)/1000.0 from public.runs r where r.team_id=t.id and r.verification_status in ('pending','verified') and r.started_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),
 'recorded_total_km',(select coalesce(sum(r.distance_m),0)/1000.0 from public.runs r where r.team_id=t.id and r.verification_status in ('pending','verified')),
 'recorded_run_count',(select count(*) from public.runs r where r.team_id=t.id and r.verification_status in ('pending','verified') and r.started_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),
 'my_recorded_km',(select coalesce(sum(r.distance_m),0)/1000.0 from public.runs r where r.team_id=t.id and r.user_id=auth.uid() and r.verification_status in ('pending','verified') and r.started_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),
 'members',(select coalesce(jsonb_agg(jsonb_build_object('nickname',coalesce(p.nickname,'Runner'),'distance_km',coalesce(d.meters,0)/1000.0,'recorded_distance_km',coalesce(d.recorded_meters,0)/1000.0)),'[]')
 from public.team_members m left join public.profiles p on p.id=m.user_id
 left join lateral(select sum(r.distance_m) filter(where r.verification_status='verified') meters,sum(r.distance_m) recorded_meters from public.runs r where r.team_id=t.id and r.user_id=m.user_id and r.verification_status in ('pending','verified') and r.started_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC') d on true
 where m.team_id=t.id))
 from public.teams t join public.team_members me on me.team_id=t.id where me.user_id=auth.uid();
$$;

revoke all on function public.get_my_team() from public, anon;
grant execute on function public.get_my_team() to authenticated;
