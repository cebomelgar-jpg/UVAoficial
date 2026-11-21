create or replace function public.admin_delete_support_conversation(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved() or not public.is_admin() then
    raise exception 'Se requieren permisos de administrador.';
  end if;

  delete from public.support_conversations
  where id = p_conversation_id
    and admin_id = auth.uid();

  if not found then
    raise exception 'Conversación no encontrada o no autorizada.';
  end if;
end;
$$;

revoke all on function public.admin_delete_support_conversation(uuid)
  from public, anon;
grant execute on function public.admin_delete_support_conversation(uuid)
  to authenticated;
