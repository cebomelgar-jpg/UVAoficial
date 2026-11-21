-- E2E encrypted, short-lived patient/admin conversations and internal requests.

create table if not exists public.support_chat_keys (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  public_key text not null check (length(public_key) between 80 and 256),
  created_at timestamptz not null default now()
);

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  admin_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 minutes'),
  constraint support_conversation_participants_differ check (patient_id <> admin_id)
);

create index if not exists support_conversations_patient_expiry_idx
  on public.support_conversations (patient_id, expires_at desc);
create index if not exists support_conversations_admin_expiry_idx
  on public.support_conversations (admin_id, expires_at desc);

create table if not exists public.support_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  ciphertext text not null
    check (length(ciphertext) between 24 and 8000)
    check (ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$'),
  iv text not null
    check (length(iv) = 16)
    check (iv ~ '^[A-Za-z0-9+/]{16}$'),
  created_at timestamptz not null default now()
);

create index if not exists support_chat_messages_conversation_created_idx
  on public.support_chat_messages (conversation_id, created_at);

create table if not exists public.support_contact_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null
    check (request_type in ('password', 'privacy', 'general')),
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  email text not null check (length(email) between 6 and 254),
  phone text not null check (length(phone) between 6 and 30),
  status text not null default 'pending'
    check (status in ('pending', 'handled')),
  created_at timestamptz not null default now()
);

create index if not exists support_contact_requests_created_idx
  on public.support_contact_requests (created_at desc);

alter table public.support_chat_keys enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_chat_messages enable row level security;
alter table public.support_contact_requests enable row level security;

create or replace function public.primary_support_admin_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where role = 'admin' and status = 'approved'
  order by created_at, id
  limit 1;
$$;

revoke all on function public.primary_support_admin_id() from public;
grant execute on function public.primary_support_admin_id() to authenticated;

drop policy if exists "support_chat_keys_select" on public.support_chat_keys;
create policy "support_chat_keys_select"
  on public.support_chat_keys for select to authenticated
  using (
    public.is_approved()
    and (
      user_id = auth.uid()
      or public.is_admin()
      or user_id = public.primary_support_admin_id()
    )
  );

drop policy if exists "support_chat_keys_insert_own" on public.support_chat_keys;
create policy "support_chat_keys_insert_own"
  on public.support_chat_keys for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved());

drop policy if exists "support_conversations_select_participant" on public.support_conversations;
create policy "support_conversations_select_participant"
  on public.support_conversations for select to authenticated
  using (
    public.is_approved()
    and expires_at > now()
    and (
      patient_id = auth.uid()
      or (admin_id = auth.uid() and public.is_admin())
    )
  );

drop policy if exists "support_chat_messages_select_participant" on public.support_chat_messages;
create policy "support_chat_messages_select_participant"
  on public.support_chat_messages for select to authenticated
  using (
    public.is_approved()
    and exists (
      select 1
      from public.support_conversations c
      where c.id = conversation_id
        and c.expires_at > now()
        and (
          c.patient_id = auth.uid()
          or (c.admin_id = auth.uid() and public.is_admin())
        )
    )
  );

drop policy if exists "support_chat_messages_insert_participant" on public.support_chat_messages;
create policy "support_chat_messages_insert_participant"
  on public.support_chat_messages for insert to authenticated
  with check (
    public.is_approved()
    and sender_id = auth.uid()
    and exists (
      select 1
      from public.support_conversations c
      where c.id = conversation_id
        and c.expires_at > now()
        and (
          c.patient_id = auth.uid()
          or (c.admin_id = auth.uid() and public.is_admin())
        )
    )
  );

drop policy if exists "support_contact_requests_admin_select" on public.support_contact_requests;
create policy "support_contact_requests_admin_select"
  on public.support_contact_requests for select to authenticated
  using (public.is_admin());

drop policy if exists "support_contact_requests_admin_update" on public.support_contact_requests;
create policy "support_contact_requests_admin_update"
  on public.support_contact_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "support_contact_requests_admin_delete" on public.support_contact_requests;
create policy "support_contact_requests_admin_delete"
  on public.support_contact_requests for delete to authenticated
  using (public.is_admin());

create or replace function public.open_support_conversation()
returns table (
  id uuid,
  patient_id uuid,
  admin_id uuid,
  created_at timestamptz,
  last_activity_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid := auth.uid();
  v_admin_id uuid;
  v_conversation public.support_conversations%rowtype;
begin
  if v_patient_id is null or not exists (
    select 1 from public.profiles
    where profiles.id = v_patient_id
      and profiles.role = 'patient'
      and profiles.status = 'approved'
  ) then
    raise exception 'Solo pacientes habilitados pueden abrir un chat.';
  end if;

  perform 1 from public.profiles where profiles.id = v_patient_id for update;
  v_admin_id := public.primary_support_admin_id();

  if v_admin_id is null or not exists (
    select 1 from public.support_chat_keys where user_id = v_admin_id
  ) then
    raise exception 'El chat todavía no está habilitado por administración.';
  end if;

  select *
    into v_conversation
    from public.support_conversations c
    where c.patient_id = v_patient_id
      and c.expires_at > now()
    order by c.created_at desc
    limit 1;

  if found then
    return query
      select v_conversation.id, v_conversation.patient_id, v_conversation.admin_id,
        v_conversation.created_at, v_conversation.last_activity_at, v_conversation.expires_at;
    return;
  end if;

  delete from public.support_conversations c
  where c.patient_id = v_patient_id
    and c.expires_at <= now();

  insert into public.support_conversations (patient_id, admin_id)
  values (v_patient_id, v_admin_id)
  returning * into v_conversation;

  return query
    select v_conversation.id, v_conversation.patient_id, v_conversation.admin_id,
      v_conversation.created_at, v_conversation.last_activity_at, v_conversation.expires_at;
end;
$$;

revoke all on function public.open_support_conversation() from public, anon;
grant execute on function public.open_support_conversation() to authenticated;

create or replace function public.reset_support_chat_key()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1 from public.profiles
    where id = v_user_id and status = 'approved'
  ) then
    raise exception 'Se requiere una cuenta habilitada.';
  end if;

  if exists (
    select 1 from public.support_conversations c
    where c.expires_at > now()
      and (c.patient_id = v_user_id or c.admin_id = v_user_id)
  ) then
    raise exception 'Esperá a que venza la conversación activa antes de restablecer la clave.';
  end if;

  delete from public.support_chat_keys where user_id = v_user_id;
end;
$$;

revoke all on function public.reset_support_chat_key() from public, anon;
grant execute on function public.reset_support_chat_key() to authenticated;

create or replace function public.record_support_chat_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved()
     or new.sender_id <> auth.uid()
     or new.ciphertext !~ '^[A-Za-z0-9+/]+={0,2}$'
     or new.iv !~ '^[A-Za-z0-9+/]{16}$' then
    raise exception 'Mensaje cifrado inválido.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.conversation_id::text, 0));
  if (
    select count(*)
    from public.support_chat_messages m
    where m.conversation_id = new.conversation_id
      and m.sender_id = new.sender_id
      and m.created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'Alcanzaste el límite temporal de mensajes. Esperá un minuto.';
  end if;

  update public.support_conversations c
  set last_activity_at = now(),
      expires_at = now() + interval '60 minutes'
  where c.id = new.conversation_id
    and c.expires_at > now()
    and (c.patient_id = new.sender_id or c.admin_id = new.sender_id);

  if not found then
    raise exception 'El chat venció o no pertenece a esta cuenta.';
  end if;

  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists support_chat_message_activity on public.support_chat_messages;
create trigger support_chat_message_activity
  before insert on public.support_chat_messages
  for each row execute function public.record_support_chat_activity();

create or replace function public.submit_support_contact_request(
  p_request_type text,
  p_full_name text,
  p_email text,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_type text := lower(trim(coalesce(p_request_type, '')));
  v_name text := trim(coalesce(p_full_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := trim(coalesce(p_phone, ''));
  v_id uuid;
begin
  if v_type not in ('password', 'privacy', 'general')
     or length(v_name) not between 2 and 80
     or length(v_email) not between 6 and 254
     or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
     or length(v_phone) not between 6 and 30
     or v_phone !~ '^[+0-9() .-]+$' then
    raise exception 'Revisá los datos de contacto ingresados.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));
  if exists (
    select 1 from public.support_contact_requests r
    where lower(r.email) = v_email
      and r.created_at > now() - interval '5 minutes'
  ) then
    raise exception 'Ya recibimos una solicitud reciente. Esperá unos minutos antes de volver a enviarla.';
  end if;

  insert into public.support_contact_requests (request_type, full_name, email, phone)
  values (v_type, v_name, v_email, v_phone)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_support_contact_request(text, text, text, text) from public;
grant execute on function public.submit_support_contact_request(text, text, text, text) to anon, authenticated;

revoke all on public.support_chat_keys, public.support_conversations,
  public.support_chat_messages, public.support_contact_requests from anon, authenticated;
grant select, insert on public.support_chat_keys to authenticated;
grant select on public.support_conversations to authenticated;
grant select, insert on public.support_chat_messages to authenticated;
grant select, update, delete on public.support_contact_requests to authenticated;

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'uva-cleanup-ephemeral-support'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'uva-cleanup-ephemeral-support',
    '* * * * *',
    $job$
      do $cleanup$
      begin
        delete from public.support_conversations where expires_at <= now();
        delete from public.support_contact_requests
        where created_at < now() - interval '7 days';
      end
      $cleanup$;
    $job$
  );
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_chat_messages'
  ) then
    alter publication supabase_realtime add table public.support_chat_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_conversations'
  ) then
    alter publication supabase_realtime add table public.support_conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'support_contact_requests'
  ) then
    alter publication supabase_realtime add table public.support_contact_requests;
  end if;
end
$$;
