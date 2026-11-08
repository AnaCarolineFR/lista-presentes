-- =====================================================================
-- Desejos da Carol · estrutura do banco (Supabase / Postgres)
-- Rode este arquivo uma vez no SQL Editor do Supabase.
--
-- Quem pode o quê é decidido pelas regras (RLS) no fim do arquivo:
--   dono   → vê e edita a lista (Carol)
--   leitor → só vê a lista (namorado, visitante da demonstração)
-- =====================================================================

-- ---------- Tabelas ----------

create table if not exists public.listas (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,              -- 'carol', 'demo'
  nome        text not null,                     -- nome que aparece no "Bem-vindo aos desejos da ..."
  frase       text,                              -- lema do topo
  legenda     text,                              -- texto embaixo da foto
  foto        text,                              -- caminho no Storage (bucket 'fotos')
  criado_em   timestamptz not null default now()
);

create table if not exists public.acessos (
  lista_id  uuid not null references public.listas (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  papel     text not null check (papel in ('dono', 'leitor')),
  primary key (lista_id, user_id)
);

create table if not exists public.itens (
  lista_id       uuid not null references public.listas (id) on delete cascade,
  id             text not null,                  -- slug do item, ex.: 'brinco-argola'
  ordem          int  not null default 0,
  nome           text not null,
  descricao      text,
  detalhes       text,
  comentario     text,                           -- "nota da Carol"
  categoria      text not null,
  tipo           text,                           -- camada fixa (opcional); sem ela, vale o preço
  emoji          text,
  imagem         text,                           -- caminho no Storage (bucket 'fotos')
  -- itens de valor estimado (viagens, experiências, delivery)
  estimado       numeric(10, 2),
  estimado_nota  text,
  individual     boolean not null default false, -- true = estimativa pra 1 pessoa
  simulacao      boolean not null default false,
  quando         text,
  titulo_links   text,
  pesquisado_em  date,
  links          jsonb,                          -- [{nome, obs, url}]
  custos         jsonb,                          -- [{item, obs, valor}]
  roteiro        jsonb,                          -- [{dia, titulo, texto}]
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  primary key (lista_id, id)
);

create table if not exists public.precos (
  id              bigint generated always as identity primary key,
  lista_id        uuid not null,
  item_id         text not null,
  loja            text not null,
  url             text,
  preco           numeric(10, 2) not null default 0,
  preco_anterior  numeric(10, 2),
  disponivel      boolean not null default true,
  atualizado_em   timestamptz not null default now(),
  foreign key (lista_id, item_id) references public.itens (lista_id, id) on delete cascade on update cascade
);
create index if not exists precos_item_idx on public.precos (lista_id, item_id);

create table if not exists public.datas (
  id         bigint generated always as identity primary key,
  lista_id   uuid not null references public.listas (id) on delete cascade,
  ordem      int  not null default 0,
  nome       text not null,
  tipo       text,                               -- null | mensal | pascoa | blackfriday | periodo | sempre
  dia        int,
  mes        int,
  desde_ano  int,
  desde_mes  int,
  rotulo     text,                               -- ex.: 'faço {n} anos 😌'
  camada     text,
  nota       text,
  periodos   jsonb                               -- [["2027-01-10","2027-01-15"], ...]
);

-- ---------- Funções de permissão ----------
-- security definer: leem 'acessos' sem esbarrar nas próprias regras.

create or replace function public.pode_ver(l uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from acessos where lista_id = l and user_id = auth.uid());
$$;

create or replace function public.pode_editar(l uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from acessos where lista_id = l and user_id = auth.uid() and papel = 'dono');
$$;

-- ---------- Regras de acesso (RLS) ----------

alter table public.listas  enable row level security;
alter table public.acessos enable row level security;
alter table public.itens   enable row level security;
alter table public.precos  enable row level security;
alter table public.datas   enable row level security;

-- listas
drop policy if exists "ver lista" on public.listas;
create policy "ver lista" on public.listas for select to authenticated using (pode_ver(id));
drop policy if exists "editar lista" on public.listas;
create policy "editar lista" on public.listas for update to authenticated using (pode_editar(id)) with check (pode_editar(id));

-- acessos: cada um só enxerga os próprios acessos (é assim que o site descobre qual lista abrir)
drop policy if exists "ver meus acessos" on public.acessos;
create policy "ver meus acessos" on public.acessos for select to authenticated using (user_id = auth.uid());

-- itens, preços e datas: vê quem tem acesso; edita só o dono
do $$
declare t text;
begin
  foreach t in array array['itens', 'precos', 'datas'] loop
    execute format('drop policy if exists "ver" on public.%I', t);
    execute format('create policy "ver" on public.%I for select to authenticated using (pode_ver(lista_id))', t);
    execute format('drop policy if exists "criar" on public.%I', t);
    execute format('create policy "criar" on public.%I for insert to authenticated with check (pode_editar(lista_id))', t);
    execute format('drop policy if exists "editar" on public.%I', t);
    execute format('create policy "editar" on public.%I for update to authenticated using (pode_editar(lista_id)) with check (pode_editar(lista_id))', t);
    execute format('drop policy if exists "apagar" on public.%I', t);
    execute format('create policy "apagar" on public.%I for delete to authenticated using (pode_editar(lista_id))', t);
  end loop;
end $$;

-- ---------- Fotos (Storage) ----------
-- Bucket privado. Cada arquivo fica numa pasta com o id da lista:
--   fotos/<lista_id>/topo.webp, fotos/<lista_id>/itens/brinco.jpg

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

drop policy if exists "ver fotos da lista" on storage.objects;
create policy "ver fotos da lista" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.pode_ver(((storage.foldername(name))[1])::uuid));

drop policy if exists "enviar fotos da lista" on storage.objects;
create policy "enviar fotos da lista" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.pode_editar(((storage.foldername(name))[1])::uuid));

drop policy if exists "trocar fotos da lista" on storage.objects;
create policy "trocar fotos da lista" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.pode_editar(((storage.foldername(name))[1])::uuid));

drop policy if exists "apagar fotos da lista" on storage.objects;
create policy "apagar fotos da lista" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.pode_editar(((storage.foldername(name))[1])::uuid));

-- Mantém atualizado_em em dia quando um item é editado
create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists itens_atualizado_em on public.itens;
create trigger itens_atualizado_em before update on public.itens
  for each row execute function public.tocar_atualizado_em();
