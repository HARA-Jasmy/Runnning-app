-- Applied remotely as profile_avatar. Run after the initial schema for a new environment.
alter table public.profiles add column if not exists avatar_data text check (avatar_data is null or (length(avatar_data) <= 150000 and avatar_data ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$'));
