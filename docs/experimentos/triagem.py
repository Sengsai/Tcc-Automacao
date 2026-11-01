#!/usr/bin/env python3
"""Totais e frequências da triagem da revisão integrativa.

Lê o inventário da busca de 22/09/2026 (um registro por item, com as consultas
que o devolveram, o código e a decisão) e imprime as contagens usadas na
seção 4.1.1 e nos Quadros 16, 17 e 20 do trabalho.

Usa apenas a biblioteca padrão do Python 3; não há dependências a instalar.
"""
import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

PADRAO = Path(__file__).with_name("inventario_busca_set2026.json")

# Rótulos do Quadro 17 (Apêndice B), na mesma ordem do quadro.
MOTIVOS = {
    "X1": "Sem controle baseado em detecção de presença",
    "X4": "Fora do tema (sem controle de iluminação ou temperatura)",
    "X3": "Sem arquitetura computacional descrita (simulação energética)",
    "X7": "Sem arquitetura computacional de controle (controle apenas simulado)",
    "X6": "Trabalho de conclusão de graduação ou técnico",
    "X11": "Edificação de grande porte, indústria ou hospital",
    "X9": "Ambiente externo",
    "X2": "Publicação anterior a 2016",
    "X5": "Texto integral indisponível sem informações públicas suficientes",
    "X10": "Veículo ou texto não identificável",
    "X8": "Não revisado por pares",
    "X12": "Sem resultado de avaliação do sistema relatado",
}


def argumentos() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Recalcula os números da triagem da revisão a partir do inventário da busca.",
        epilog="Exemplo: python3 docs/experimentos/triagem.py",
    )
    p.add_argument("inventario", nargs="?", type=Path, default=PADRAO,
                   help=f"arquivo JSON do inventário (padrão: {PADRAO.name}, na mesma pasta do script)")
    p.add_argument("-s", "--saida", type=Path,
                   help="grava o resumo também neste arquivo de texto, além de imprimir na tela")
    return p.parse_args()


def resumo(registros: list[dict]) -> str:
    linhas: list[str] = []
    out = linhas.append

    ocorrencias = sum(sum(r["consultas"].values()) for r in registros)
    pares = sum(len(r["consultas"]) for r in registros)  # registro × consulta distintos
    distintos = len(registros)
    na = [r for r in registros if r["codigo"] == "NA"]
    incluidos = [r for r in registros if r["codigo"].startswith("E")]
    excluidos = [r for r in registros if r["codigo"] in MOTIVOS]
    assert len(na) + len(incluidos) + len(excluidos) == distintos, "registro com código desconhecido"

    out(f"Ocorrências devolvidas: {ocorrencias}")
    out(f"Repetições: {ocorrencias - distintos} "
        f"({ocorrencias - pares} dentro da mesma consulta, {pares - distintos} entre consultas)")
    out(f"Registros distintos: {distintos}")
    out(f"Fontes não acadêmicas (NA), removidas antes da triagem: {len(na)}")
    out(f"Triados: {distintos - len(na)}")
    out(f"Incluídos: {len(incluidos)} ({', '.join(sorted(r['codigo'] for r in incluidos))})")
    out(f"Excluídos: {len(excluidos)}")
    out("")
    out("Motivos de exclusão (Quadro 17):")
    contagem = Counter(r["codigo"] for r in excluidos)
    for codigo, rotulo in MOTIVOS.items():
        out(f"  {codigo:<4} {contagem[codigo]:2d}  {rotulo}")
    out("")
    out("Por consulta (Quadro 16): ocorrências / distintos / incluídos")
    por_consulta: dict[int, list] = defaultdict(lambda: [0, 0, []])
    for r in registros:
        for consulta, n in r["consultas"].items():
            c = por_consulta[int(consulta)]
            c[0] += n
            c[1] += 1
            if r["codigo"].startswith("E"):
                c[2].append(r["codigo"])
    for consulta in sorted(por_consulta):
        occ, dist, inc = por_consulta[consulta]
        out(f"  C{consulta:<3d}{occ:2d} / {dist:2d} / {', '.join(inc) or '—'}")
    return "\n".join(linhas)


def main() -> int:
    args = argumentos()
    if not args.inventario.exists():
        print(f"Inventário não encontrado: {args.inventario}", file=sys.stderr)
        return 1
    texto = resumo(json.loads(args.inventario.read_text(encoding="utf-8")))
    print(texto)
    if args.saida:
        args.saida.write_text(texto + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
