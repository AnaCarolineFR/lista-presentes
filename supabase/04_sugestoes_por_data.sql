-- =====================================================================
-- Sugestões das datas viram uma faixa de camadas (nunca Sonhos):
--   datas pequenas    → Mimos e Fáceis
--   datas importantes → Fáceis, Moderados e Especiais
-- Vale pras duas listas (Carol e demonstração). Pode rodar de novo à vontade.
-- =====================================================================

update public.datas set camada = 'mimo,facil'
where camada in ('mimo', 'facil');

update public.datas set camada = 'facil,moderado,especial'
where camada in ('moderado', 'especial', 'sonho');

update public.datas
set nota = 'Não é feriado, mas os preços estão ótimos. Hora de riscar um desejo maior da lista.'
where nome = 'Black Friday';

-- Conferência
select l.slug, d.nome, d.camada
from public.datas d join public.listas l on l.id = d.lista_id
order by l.slug, d.ordem;
