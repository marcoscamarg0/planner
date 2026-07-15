-- Drop existing triggers
drop trigger if exists on_auth_user_created on auth.users;


-- Drop existing tables and functions to reset the database
drop table if exists public.project_members cascade;
drop table if exists public.ai_insights cascade;
drop table if exists public.tasks cascade;
drop table if exists public.pages cascade;
drop table if exists public.projects cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_updated_at() cascade;
drop function if exists public.handle_new_user() cascade;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Projects table
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  status text default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  color text default '#6366f1',
  emoji text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Pages table (hierarchical, stores TipTap JSON)
create table public.pages (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  parent_id uuid references public.pages(id) on delete set null,
  title text not null default 'Sem título',
  content jsonb,
  icon text,
  cover_url text,
  order_index integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Tasks table
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  page_id uuid references public.pages(id) on delete set null,
  title text not null,
  description text,
  status text default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- AI Insights table
create table public.ai_insights (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  page_id uuid references public.pages(id) on delete cascade,
  content text not null,
  type text default 'summary' check (type in ('summary', 'suggestion', 'alert', 'progress')),
  metadata jsonb,
  is_read boolean default false,
  created_at timestamptz default now() not null
);

-- Project members table
create table public.project_members (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'editor' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz default now() not null,
  unique(project_id, user_id)
);

-- Indexes
create index idx_projects_owner_id on public.projects(owner_id);
create index idx_pages_project_id on public.pages(project_id);
create index idx_pages_parent_id on public.pages(parent_id);
create index idx_tasks_project_id on public.tasks(project_id);
create index idx_tasks_page_id on public.tasks(page_id);
create index idx_tasks_status on public.tasks(status);
create index idx_ai_insights_project_id on public.ai_insights(project_id);
create index idx_project_members_user_id on public.project_members(user_id);

-- Updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.projects
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.pages
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.tasks
  for each row execute procedure public.handle_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.pages enable row level security;
alter table public.tasks enable row level security;
alter table public.ai_insights enable row level security;
alter table public.project_members enable row level security;

-- Profiles policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Projects policies
create policy "Users can view own projects" on public.projects
  for select using (
    auth.uid() = owner_id or
    exists (
      select 1 from public.project_members
      where project_id = projects.id and user_id = auth.uid()
    )
  );
create policy "Users can create projects" on public.projects
  for insert with check (auth.uid() = owner_id);
create policy "Owners can update projects" on public.projects
  for update using (auth.uid() = owner_id);
create policy "Owners can delete projects" on public.projects
  for delete using (auth.uid() = owner_id);

-- Pages policies
create policy "Users can view pages of accessible projects" on public.pages
  for select using (
    exists (
      select 1 from public.projects
      where id = pages.project_id and (
        owner_id = auth.uid() or
        exists (select 1 from public.project_members where project_id = projects.id and user_id = auth.uid())
      )
    )
  );
create policy "Users can create pages in accessible projects" on public.pages
  for insert with check (
    exists (
      select 1 from public.projects
      where id = project_id and (
        owner_id = auth.uid() or
        exists (select 1 from public.project_members where project_id = projects.id and user_id = auth.uid() and role in ('owner', 'editor'))
      )
    )
  );
create policy "Users can update pages in accessible projects" on public.pages
  for update using (
    exists (
      select 1 from public.projects
      where id = pages.project_id and (
        owner_id = auth.uid() or
        exists (select 1 from public.project_members where project_id = projects.id and user_id = auth.uid() and role in ('owner', 'editor'))
      )
    )
  );
create policy "Users can delete pages in own projects" on public.pages
  for delete using (
    exists (
      select 1 from public.projects
      where id = pages.project_id and owner_id = auth.uid()
    )
  );

-- Tasks policies
create policy "Users can view tasks of accessible projects" on public.tasks
  for select using (
    exists (
      select 1 from public.projects
      where id = tasks.project_id and (
        owner_id = auth.uid() or
        exists (select 1 from public.project_members where project_id = projects.id and user_id = auth.uid())
      )
    )
  );
create policy "Users can manage tasks in accessible projects" on public.tasks
  for all using (
    exists (
      select 1 from public.projects
      where id = tasks.project_id and (
        owner_id = auth.uid() or
        exists (select 1 from public.project_members where project_id = projects.id and user_id = auth.uid() and role in ('owner', 'editor'))
      )
    )
  );

-- AI Insights policies
create policy "Users can view insights of accessible projects" on public.ai_insights
  for select using (
    exists (
      select 1 from public.projects
      where id = ai_insights.project_id and (
        owner_id = auth.uid() or
        exists (select 1 from public.project_members where project_id = projects.id and user_id = auth.uid())
      )
    )
  );
create policy "Service role can manage insights" on public.ai_insights
  for all using (true);

-- Helper function to break infinite recursion
create or replace function public.is_project_owner(project_uuid uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.projects
    where id = project_uuid and owner_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- Project members policies
create policy "Members can view project members" on public.project_members
  for select using (
    user_id = auth.uid() or
    public.is_project_owner(project_id)
  );
create policy "Owners can manage project members" on public.project_members
  for all using (
    public.is_project_owner(project_id)
  );
