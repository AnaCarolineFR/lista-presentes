# Lista de Desejos ♥

Uma lista de desejos com cara de diário: os presentes ficam organizados em **5 camadas de preço**
(de Mimos a Sonhos), cada item compara o preço em **até 5 lojas**, viagens e experiências ganham
**custos detalhados e roteiro**, e um **calendário de datas** lembra quando é hora de presentear.

## Experimente

Existe uma lista de demonstração com uma pessoa fictícia, a **Lia**. O acesso de visitante é
liberado sob pedido. Fale comigo pra receber o login.

> A lista real fica protegida: cada usuário só enxerga as listas liberadas pra ele.

## Como funciona

- **Site estático** (HTML, CSS e JavaScript puro, sem build), hospedado no GitHub Pages.
- **Supabase** guarda tudo: login (Auth), banco Postgres e fotos (Storage privado).
- **Regras de acesso no banco (RLS):** o código do site é público, mas os dados não. O banco só
  entrega uma lista pra quem tem acesso a ela:
  - `dono` vê e edita (cadastra itens, preços, datas e fotos pela página de admin);
  - `leitor` só vê.
- **3 estilos visuais** (Scrapbook, Y2K e Café), trocados pelo seletor no rodapé.

## Páginas

| Página | O que faz |
|---|---|
| `login.html` | Entrada com e-mail e senha |
| `index.html` | A lista: camadas, filtros por categoria e calendário de datas |
| `item.html` | Detalhes do desejo, lojas da mais barata pra mais cara, ou custos e roteiro |
| `admin.html` | Só pra dona da lista: desejos, topo da lista, fotos e calendário |

## Montando o seu

1. Crie um projeto no [Supabase](https://supabase.com).
2. No **SQL Editor**, rode na ordem:
   1. `supabase/01_schema.sql` (tabelas, regras de acesso e bucket de fotos)
   2. `supabase/02_seed_demo.sql` (lista de demonstração)
   3. `supabase/04_sugestoes_por_data.sql`
3. Crie os usuários em **Authentication → Users** (marque *Auto Confirm User*) e libere o acesso
   deles com um SQL como o de `supabase/03_acessos.sql`.
4. Em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**, pra
   ninguém criar conta sozinho.
5. Coloque a URL do projeto e a chave **publishable** (anon) em `js/config.js`.
   Nunca coloque a chave `service_role` no site.

Pra carregar uma lista a partir de JSONs (formato de `data/demo/`):

```bash
python3 supabase/gerar_seed.py data/demo supabase/02_seed_demo.sql
```

## Rodar localmente

```bash
python3 -m http.server 8123
```

Depois abra http://localhost:8123. Abrir o `index.html` direto do disco não funciona.

## Estrutura

| Caminho | O que tem |
|---|---|
| `js/config.js` | URL e chave publishable do Supabase |
| `js/db.js` | Login, listas do usuário, itens, preços, datas e fotos |
| `js/app.js` | Camadas (limites de preço), categorias e telas da lista |
| `js/admin.js` | Página de admin |
| `css/style.css` | Os 3 estilos |
| `supabase/` | SQL do banco e gerador de carga |
| `data/demo/` | Dados fictícios da lista de demonstração |
