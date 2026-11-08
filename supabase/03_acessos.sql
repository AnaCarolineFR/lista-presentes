-- =====================================================================
-- Quem acessa cada lista.
-- Modelo: troque os e-mails e o slug da lista pelos seus. Os usuários precisam existir em Authentication → Users.
-- Pode rodar de novo à vontade.
-- =====================================================================

-- Dona: edita a própria lista e também enxerga a demonstração
insert into public.acessos (lista_id, user_id, papel)
select l.id, u.id, case l.slug when 'minha-lista' then 'dono' else 'leitor' end
from auth.users u cross join public.listas l
where u.email = 'DONA_DA_LISTA@exemplo.com' and l.slug in ('minha-lista', 'demo')
on conflict (lista_id, user_id) do update set papel = excluded.papel;

-- Leitor: só vê a lista da dona
insert into public.acessos (lista_id, user_id, papel)
select l.id, u.id, 'leitor'
from auth.users u join public.listas l on l.slug = 'minha-lista'
where u.email = 'QUEM_SO_VE@exemplo.com'
on conflict (lista_id, user_id) do update set papel = excluded.papel;

-- Visitante: só vê a lista de demonstração
insert into public.acessos (lista_id, user_id, papel)
select l.id, u.id, 'leitor'
from auth.users u join public.listas l on l.slug = 'demo'
where u.email = 'visitante@desejos.app'
on conflict (lista_id, user_id) do update set papel = excluded.papel;

-- Conferência: deve listar 4 linhas (dona ×2, leitor, visitante)
select u.email, l.slug, a.papel
from public.acessos a
join auth.users u on u.id = a.user_id
join public.listas l on l.id = a.lista_id
order by u.email, l.slug;
