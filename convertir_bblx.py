#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
convertir_bblx.py  —  Convierte un módulo de Biblia e-Sword (.bblx / .bbl,
formato SQLite con tabla Bible(Book,Chapter,Verse,Scripture) y Details)
al JSON compacto que usa la aplicación "Escudriñad".

Uso:  python3 convertir_bblx.py entrada.bblx salida.json [id_corto]
"""
import sqlite3, json, sys, os, re

def convert(path, out, short_id=None):
    con = sqlite3.connect(path)
    cur = con.cursor()

    # metadatos
    d = {}
    try:
        cur.execute("SELECT Description, Abbreviation, Strong FROM Details")
        row = cur.fetchone()
        if row:
            d['name'] = (row[0] or '').strip()
            d['abbr'] = (row[1] or '').strip()
            d['strong'] = bool(row[2])
    except sqlite3.OperationalError:
        pass

    name = d.get('name') or os.path.splitext(os.path.basename(path))[0]
    abbr = d.get('abbr') or name[:12]
    ident = short_id or re.sub(r'[^A-Za-z0-9]+', '', abbr) or 'BIB'

    # versículos agrupados por libro/capítulo
    cur.execute("SELECT Book, Chapter, Verse, Scripture FROM Bible ORDER BY Book, Chapter, Verse")
    books = {}
    for b, c, v, s in cur.fetchall():
        bk = books.setdefault(b, {})
        ch = bk.setdefault(c, {})
        ch[v] = s if s is not None else ''

    out_books = []
    for b in sorted(books):
        chapters = []
        for c in sorted(books[b]):
            verses = books[b][c]
            # rellena huecos de numeración con cadena vacía para mantener índice
            maxv = max(verses)
            arr = [verses.get(i, '') for i in range(1, maxv + 1)]
            chapters.append(arr)
        out_books.append({'n': b, 'ch': chapters})

    data = {
        'id': ident,
        'name': name,
        'abbr': abbr,
        'lang': 'es',
        'strong': d.get('strong', False),
        'books': out_books,
    }

    with open(out, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

    nverses = sum(len(ch) for bk in out_books for ch in bk['ch'])
    print(f"OK  {name} [{abbr}] id={ident}")
    print(f"    libros={len(out_books)}  versículos={nverses}")
    print(f"    salida={out}  ({os.path.getsize(out)/1_048_576:.2f} MB)")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    convert(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
