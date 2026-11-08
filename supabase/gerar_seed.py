"""Gera o SQL que carrega uma lista (itens, preços e datas) no Supabase.

Uso:
    python3 supabase/gerar_seed.py data/demo  supabase/02_seed_demo.sql
    python3 supabase/gerar_seed.py supabase/privado/data supabase/privado/seed.sql   # sua lista real (fora do git)

A pasta precisa ter lista.json, itens.json, precos.json e datas.json.
O id da lista é fixo (derivado do slug), então as fotos no Storage ficam em
fotos/<id da lista>/... e o SQL pode ser rodado de novo sem duplicar nada.
"""
import json
import sys
import uuid
from pathlib import Path

NAMESPACE = uuid.UUID("6f1d3c2e-8a4b-4e2f-9c1d-5b7a0e3f2d10")


def lista_id(slug):
    return str(uuid.uuid5(NAMESPACE, slug))


def q(valor):
    """Literal SQL: texto, número, booleano, null ou jsonb."""
    if valor is None:
        return "null"
    if isinstance(valor, bool):
        return "true" if valor else "false"
    if isinstance(valor, (int, float)):
        return repr(valor)
    if isinstance(valor, (list, dict)):
        return q(json.dumps(valor, ensure_ascii=False)) + "::jsonb"
    return "'" + str(valor).replace("'", "''") + "'"


def caminho_foto(lid, imagem):
    # 'img/itens/brinco.jpg' → '<lista>/itens/brinco.jpg'; 'topo.webp' → '<lista>/topo.webp'
    if not imagem:
        return None
    nome = imagem.removeprefix("img/")
    return f"{lid}/{nome}"


def gerar(pasta):
    pasta = Path(pasta)
    lista = json.loads((pasta / "lista.json").read_text(encoding="utf-8"))
    itens = json.loads((pasta / "itens.json").read_text(encoding="utf-8"))
    precos = json.loads((pasta / "precos.json").read_text(encoding="utf-8"))["itens"]
    datas = json.loads((pasta / "datas.json").read_text(encoding="utf-8"))
    lid = lista_id(lista["slug"])

    sql = [
        f"-- Lista '{lista['slug']}' gerada por supabase/gerar_seed.py",
        "begin;",
        # Recria a lista do zero: os itens, preços e datas caem junto (on delete cascade),
        # mas os acessos também; por isso eles ficam num arquivo à parte (03_acessos.sql).
        f"delete from public.listas where id = {q(lid)};",
        "insert into public.listas (id, slug, nome, frase, legenda, foto) values "
        f"({q(lid)}, {q(lista['slug'])}, {q(lista['nome'])}, {q(lista.get('frase'))}, "
        f"{q(lista.get('legenda'))}, {q(caminho_foto(lid, lista.get('foto')))});",
    ]

    colunas = ["nome", "descricao", "detalhes", "comentario", "categoria", "tipo", "emoji",
               "estimado", "estimado_nota", "individual", "simulacao", "quando", "titulo_links",
               "pesquisado_em", "links", "custos", "roteiro"]
    for ordem, item in enumerate(itens):
        valores = [q(item.get(c, False if c in ("individual", "simulacao") else None)) for c in colunas]
        sql.append(
            f"insert into public.itens (lista_id, id, ordem, imagem, {', '.join(colunas)}) values "
            f"({q(lid)}, {q(item['id'])}, {ordem}, {q(caminho_foto(lid, item.get('imagem')))}, {', '.join(valores)});"
        )

    for item_id, ofertas in precos.items():
        for o in ofertas:
            sql.append(
                "insert into public.precos (lista_id, item_id, loja, url, preco, preco_anterior, disponivel) values "
                f"({q(lid)}, {q(item_id)}, {q(o['loja'])}, {q(o.get('url') or None)}, {q(o.get('preco', 0))}, "
                f"{q(o.get('preco_anterior'))}, {q(o.get('disponivel', True))});"
            )

    for ordem, d in enumerate(datas):
        sql.append(
            "insert into public.datas (lista_id, ordem, nome, tipo, dia, mes, desde_ano, desde_mes, rotulo, camada, nota, periodos) values "
            f"({q(lid)}, {ordem}, {q(d['nome'])}, {q(d.get('tipo'))}, {q(d.get('dia'))}, {q(d.get('mes'))}, "
            f"{q(d.get('desdeAno'))}, {q(d.get('desdeMes'))}, {q(d.get('rotulo'))}, {q(d.get('camada'))}, "
            f"{q(d.get('nota'))}, {q(d.get('periodos'))});"
        )

    sql.append("commit;")
    return lid, "\n".join(sql) + "\n"


if __name__ == "__main__":
    pasta, destino = sys.argv[1], Path(sys.argv[2])
    lid, sql = gerar(pasta)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(sql, encoding="utf-8")
    print(f"{destino}: lista {lid}")
