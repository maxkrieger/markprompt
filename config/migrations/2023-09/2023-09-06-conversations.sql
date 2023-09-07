create table public.conversations (
  id         uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  project_id uuid references public.projects on delete cascade not null
);
comment on table public.conversations is 'Conversations.';

alter table query_stats
add column conversation_id uuid references public.conversations on delete cascade;

-- Migration: create a new converation for each query_stats row
do $$
declare
  row_query_stats query_stats%ROWTYPE;
  v_conversation_id uuid;
begin
  for row_query_stats in select * from query_stats
  loop
    insert into conversations (project_id, created_at)
    values (row_query_stats.project_id, row_query_stats.created_at)
    returning id into v_conversation_id;
    update query_stats
    set conversation_id = v_conversation_id
    where id = row_query_stats.id;
  end loop;
end $$;

-- IMPORTANT: now set converation_id to not nullable in Supabase

-- RLS

alter table conversations
  enable row level security;

create policy "Users can only see conversations associated to projects they have access to." on public.conversations
  for select using (
    conversations.project_id in (
      select projects.id from projects
      left join memberships
      on projects.team_id = memberships.team_id
      where memberships.user_id = auth.uid()
    )
  );

create policy "Users can insert conversations associated to projects they have access to." on public.conversations
  for insert with check (
    conversations.project_id in (
      select projects.id from projects
      left join memberships
      on projects.team_id = memberships.team_id
      where memberships.user_id = auth.uid()
    )
  );

create policy "Users can update conversations associated to projects they have access to." on public.conversations
  for update using (
    conversations.project_id in (
      select projects.id from projects
      left join memberships
      on projects.team_id = memberships.team_id
      where memberships.user_id = auth.uid()
    )
  );

create policy "Users can delete conversations associated to projects they have access to." on public.conversations
  for delete using (
    conversations.project_id in (
      select projects.id from projects
      left join memberships
      on projects.team_id = memberships.team_id
      where memberships.user_id = auth.uid()
    )
  );