import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('schema enforces ownership, server-only verification, opt-in ranking and one entry per day',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.role() to authenticated;`);
 await db.exec(await readFile('supabase/migrations/202609070001_initial.sql','utf8'));
 await db.exec(await readFile('docs/team-records.sql','utf8'));
 const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
 await db.query('insert into auth.users values($1),($2)',[a,b]);
 const login=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id]);await db.exec('set role authenticated')};
 const admin=async()=>{await db.exec('reset role');await db.exec("select set_config('request.jwt.claim.role','service_role',false)")};
 await login(a);await db.query("insert into public.profiles(id,nickname) values($1,'Runner A')",[a]);
 await db.query("select public.join_team('JASMY RUNNERS')");
 const run='10000000-0000-0000-0000-000000000001';
 await db.query("insert into public.runs(id,user_id,started_at,duration_seconds,distance_m) values($1,$2,now(),900,3000)",[run,a]);
 const pendingTeam=(await db.query('select public.get_my_team() as t')).rows[0].t;assert.equal(Number(pendingTeam.recorded_distance_km),3);assert.equal(Number(pendingTeam.distance_km),0);assert.equal(Number(pendingTeam.members[0].recorded_distance_km),3);
 await assert.rejects(db.query("update public.runs set verification_status='verified' where id=$1",[run]),/server managed/);
 await login(b);assert.equal((await db.query('select public.get_my_team() as t')).rows[0].t,null);assert.equal((await db.query('select * from public.runs')).rows.length,0);assert.equal((await db.query('select * from public.profiles')).rows.length,0);
 await assert.rejects(db.query("insert into public.runs(id,user_id,started_at,duration_seconds,distance_m) values(gen_random_uuid(),$1,now(),900,3000)",[a]),/row-level security/);
 await assert.rejects(db.query("insert into public.challenge_entries values(gen_random_uuid(),$1,current_date)",[b]),/permission denied/);
 await assert.rejects(db.query("select * from public.teams"),/permission denied/);
 await admin();await db.query("update public.runs set verification_status='verified' where id=$1",[run]);
 await login(b);assert.equal((await db.query("select * from public.get_rankings('month',null,'individual')")).rows.length,0);
 await login(a);await db.query(`update public.profiles set consents='{"ranking":true}' where id=$1`,[a]);
 await login(b);const ranking=(await db.query("select * from public.get_rankings('month',null,'individual')")).rows;assert.equal(ranking[0].name,'Runner A');assert.equal(Number(ranking[0].distance_km),3);
 await db.query("select public.join_team('JASMY RUNNERS')");assert.equal((await db.query('select public.get_my_team() as t')).rows[0].t.members.length,2);
 await admin();const challenge=(await db.query("insert into public.challenges(title,starts_on,ends_on) values('Test',current_date,current_date+1) returning id")).rows[0].id;
 await login(a);await db.query('insert into public.challenge_participants(challenge_id,user_id) values($1,$2)',[challenge,a]);
 const r2='10000000-0000-0000-0000-000000000002',r3='10000000-0000-0000-0000-000000000003';
 await db.query("insert into public.runs(id,user_id,started_at,duration_seconds,distance_m) values($1,$3,now(),900,3000),($2,$3,now(),900,3000)",[r2,r3,a]);
 await admin();await db.query("update public.runs set verification_status='verified' where id in ($1,$2)",[r2,r3]);
 await login(a);assert.equal((await db.query('select * from public.challenge_entries')).rows.length,1);
 await db.query('select public.delete_my_app_data()');assert.equal((await db.query('select * from public.runs')).rows.length,0);assert.equal((await db.query('select * from public.challenge_entries')).rows.length,0);
 }finally{await db.close()}
});
