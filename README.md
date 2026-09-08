# Escudriñad — App de estudio bíblico offline

Aplicación web de una sola página para **leer, buscar y escudriñar las Escrituras**,
que lee directamente el formato de módulos **e-Sword `.bblx`** (SQLite). Pensada para
funcionar sin conexión y desplegarse en **GitHub Pages**.

Incluye ya cargada la **Reina-Valera 1960** convertida desde tu módulo.

## Estructura de archivos

```
escudrinad/
├── index.html              ← la aplicación (HTML + CSS + JS, autocontenida)
├── data/
│   └── RV1960.json         ← Biblia RV1960 convertida (4.2 MB)
├── libs/
│   ├── sql-wasm.js         ← motor SQLite (para leer .bblx en el navegador)
│   └── sql-wasm.wasm
├── convertir_bblx.py       ← convertidor por lote (.bblx → JSON)
├── parser.js               ← parser del marcado RTF (referencia; ya va embebido en index.html)
└── README.md
```

## Cómo ejecutarla

**En local** (por seguridad del navegador, `fetch` no lee archivos con `file://`):

```bash
cd escudrinad
python3 -m http.server 8000
# abre http://localhost:8000
```

**En GitHub Pages**: sube toda la carpeta al repositorio y activa Pages sobre la rama.
Funciona tal cual, incluida la lectura de `.bblx` arrastrados.

## Funciones

- **Lectura** como edición crítica: títulos de perícopa, **palabras de Cristo en rojo**
  (conmutable), marcadores de referencia cruzada (conmutable), cursivas del traductor.
- **Varias versiones**: arrastra un `.bblx`/`.bbl` a la pestaña *Biblias* y se convierte
  en el navegador; queda guardado (IndexedDB) para próximas sesiones.
- **Comparar** hasta 3 versiones en paralelo, alineadas por versículo.
- **Buscar** por palabras (Y / O / frase exacta), con *excluir*, palabra completa,
  distinguir mayúsculas y ámbito (toda la Biblia / AT / NT / libro actual). Resultados con
  conteo total y desglose por libro.
- **Subrayar** versículos en 5 colores.
- **Apartados**: agrupa versículos por tema, misterio o estudio, con nota por apartado y
  **notas por versículo**.
- **Análisis** de un término: total de apariciones, AT vs NT y distribución por libro.
- **Números de Strong**: al cargar una versión con Strong (p. ej. «RV1960 con números Strong»),
  aparece el botón **Strong** en la barra. Al activarlo se muestran los números junto a cada palabra;
  al hacer clic se abre un cuadro con la **palabra hebrea/griega**, transliteración, pronunciación,
  definición de Strong, uso y **análisis morfológico**, con enlace a todas sus apariciones.
- **Temas de lectura** (papel / sepia / noche) y tamaño de letra.
- **Exportar / importar** tu estudio completo (subrayados, notas y apartados) a un `.json`.

Todo el estudio se guarda en este navegador. Usa *Exportar* para trasladarlo.

## Añadir más versiones por lote

```bash
python3 convertir_bblx.py "MiBiblia.bblx" data/NVI.json NVI
```

Luego, para que se cargue automáticamente al iniciar, añade su nombre de archivo a la lista
de versiones precargadas en `index.html` (función `loadPrimaryJson` / arranque). O simplemente
arrástrala desde la pestaña *Biblias*.

## Sobre el formato `.bblx`

Es una base **SQLite** con dos tablas:

- `Bible(Book INT, Chapter INT, Verse INT, Scripture TEXT)`
- `Details(Description, Abbreviation, Comments, Version, Font, RightToLeft, OT, NT, Apocrypha, Strong)`

El texto de `Scripture` usa un marcado **RTF-lite**:

| Marca | Significado |
|---|---|
| `\par` | salto de párrafo |
| `{\qc \b Título\par}` | título de perícopa (encabezado) |
| `{\cf6 …}` | palabras de Cristo (rojo rúbrica) |
| `{\super\cf6 (A)}` | marcador de referencia cruzada (volado) |
| `\i … \i0` | cursiva (palabras añadidas por el traductor) |

`parser.js` traduce ese marcado a HTML seguro separando los títulos del cuerpo del versículo.

## Léxico de Strong

El archivo `data/strongs.json` contiene el léxico hebreo y griego de Strong (14,197 entradas)
que alimenta el cuadro emergente. Se carga **solo cuando se necesita** (al activar Strong o abrir
una palabra), no en el arranque.

Fuente: *Strong's Hebrew & Greek Dictionaries*, edición de **OpenScriptures**, licencia
**CC-BY-SA**. Si publicas el sitio, conserva esta atribución.

Nota: los módulos `.bblx` solo guardan los **números** de Strong y la morfología; la palabra
original y su definición provienen de este léxico. La versión «RV1960 con números Strong» es
grande (~15 MB en JSON), por eso conviene **cargarla arrastrando el `.bblx`** en la pestaña
*Biblias* (se guarda en el navegador) en lugar de subirla al repositorio.
