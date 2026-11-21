-- Permite que solicitantes autenticados usen el chat cifrado con administración,
-- sin habilitar el resto de los recursos reservados a pacientes aprobados.

drop policy if exists "support_chat_keys_select" on public.support_chat_keys;
create policy "support_chat_keys_select"
  on public.support_chat_keys for select to authenticated
  using (
    (public.is_approved() or public.is_applicant())
    and (
      user_id = auth.uid()
      or public.is_admin()
      or user_id = public.primary_support_admin_id()
    )
  );

drop policy if exists "support_chat_keys_insert_own" on public.support_chat_keys;
create policy "support_chat_keys_insert_own"
  on public.support_chat_keys for insert to authenticated
  with check (
    user_id = auth.uid()
    and (public.is_approved() or public.is_applicant())
  );

drop policy if exists "support_conversations_select_participant"
  on public.support_conversations;
create policy "support_conversations_select_participant"
  on public.support_conversations for select to authenticated
  using (
    (public.is_approved() or public.is_applicant())
    and expires_at > now()
    and (
      patient_id = auth.uid()
      or (admin_id = auth.uid() and public.is_admin())
    )
  );

drop policy if exists "support_chat_messages_select_participant"
  on public.support_chat_messages;
create policy "support_chat_messages_select_participant"
  on public.support_chat_messages for select to authenticated
  using (
    (public.is_approved() or public.is_applicant())
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

drop policy if exists "support_chat_messages_insert_participant"
  on public.support_chat_messages;
create policy "support_chat_messages_insert_participant"
  on public.support_chat_messages for insert to authenticated
  with check (
    (public.is_approved() or public.is_applicant())
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
  if v_patient_id is null or not (
    public.is_applicant()
    or exists (
      select 1 from public.profiles
      where profiles.id = v_patient_id
        and profiles.role = 'patient'
        and profiles.status = 'approved'
    )
  ) then
    raise exception 'Solo solicitantes y pacientes habilitados pueden abrir un chat.';
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
  if v_user_id is null or not (
    public.is_applicant()
    or exists (
      select 1 from public.profiles
      where id = v_user_id and status = 'approved'
    )
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
  if not (public.is_approved() or public.is_applicant())
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
