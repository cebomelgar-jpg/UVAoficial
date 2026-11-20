-- Remove la copia reversible de contraseñas y conserva el registro pendiente
-- como estado predeterminado para altas nuevas.
begin;

alter table public.profiles
  alter column status set default 'pending';

update public.profiles
set status = 'pending'
where status is null;

alter table public.profiles
  alter column status set not null;

drop table if exists public.profile_credentials;

commit;
