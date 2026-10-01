# Scouteando

![Scouteando](compartir.png)

**Ver la app:** https://joacotomada.github.io/scouteando/

App web para explorar jugadores de ligas de fútbol: equipos, planteles, fichas individuales
con comparación por puesto (percentiles) y tablas de líderes.

Proyecto personal.
Hecho con HTML, CSS y JavaScript, sin frameworks.

## Qué hace

- **Ligas:** pantalla de inicio para elegir la liga.
- **Equipos:** los clubes de la liga con su escudo y un buscador de jugadores.
- **Plantel:** resumen del equipo (goleador, asistidor, etc.) y los jugadores agrupados por puesto.
  Los que jugaron en el club pero ya no están aparecen aparte.
- **Ficha del jugador:** temporada completa, gráfico de perfil (radar) y el lugar en el ranking de su
  puesto en cada estadística (por partido o cada 90 minutos), contra jugadores con al menos 450 minutos.
- **Posiciones:** torneo actual por zonas, tabla anual y promedios.
- **Líderes:** Top 10 de la liga en cada estadística, con filtros por edad (Sub-23, Sub-21) y puesto.
- **Comparador:** dos jugadores lado a lado desde la ficha.
- **Mis jugadores:** lista de seguimiento guardada en el navegador.

## Estructura del proyecto

```
scouting-app/
├── index.html            Estructura de la página
├── estilos.css           Diseño
├── app.js                Lógica: vistas, filtros, ficha, líderes
├── ligas.js              Lista de ligas (nombre, bandera, si está disponible)
├── README.md             Este archivo
└── datos/
    ├── convertir.js      Conversor: fuentes/<liga>/ -> generados/<liga>.js
    ├── herramientas/
    │   └── bajar_tabla_fbref.js   Descarga una tabla de FBref como CSV
    ├── fuentes/
    │   └── argentina/    Datos "crudos" de la liga
    │       ├── fbref_general.csv
    │       ├── fbref_defensa.csv
    │       ├── fbref_tiros.csv
    │       ├── fbref_arqueros.csv
    │       ├── equipos.csv
    │       └── apifootball_planteles.csv
    └── generados/
        └── argentina.js  Lo que lee la app (no editar a mano)
```

La app solo lee `datos/generados/<liga>.js`, y lo carga recién cuando el usuario elige esa liga.

## Fuentes de datos

| Dato | Fuente | Archivo |
|---|---|---|
| Partidos, minutos, goles, asistencias, tarjetas | FBref, tabla "Standard" | `fbref_general.csv` |
| Intercepciones, quites, faltas recibidas, centros | FBref, tabla "Miscellaneous" | `fbref_defensa.csv` |
| Tiros y tiros al arco | FBref, tabla "Shooting" | `fbref_tiros.csv` |
| Atajadas, vallas invictas, goles recibidos | FBref, tabla "Goalkeeping" | `fbref_arqueros.csv` |
| Fotos y plantel actual | API-Football, endpoint `players/squads` | `apifootball_planteles.csv` |
| Escudos | API-Football (`media.api-sports.io/football/teams/<id>.png`) | id en `equipos.csv` |
| Banderas | flagcdn.com | código en `ligas.js` |

Los datos se usan con fines personales y educativos. Antes de un uso comercial hay que revisar
las condiciones de cada fuente.

## Cómo actualizar una liga (después de cada fecha)

1. Bajar de nuevo las 4 tablas de FBref (ver paso 2 de la sección siguiente) y reemplazarlas en
   `datos/fuentes/<liga>/`.
2. En la terminal, parado en `scouting-app`: `node datos/convertir.js <liga>`
3. En `ligas.js`, actualizar `actualizado` (la fecha del día) y `hasta` (hasta qué fecha del torneo llegan los datos, ej. "Clausura, hasta la fecha 11").

## Cómo agregar una liga

1. **Carpeta:** crear `datos/fuentes/<liga>/` (por ejemplo `datos/fuentes/brasil/`).
2. **Tablas de FBref:** abrir cada página, pegar `datos/herramientas/bajar_tabla_fbref.js` en la
   consola de Chrome y descargar:

   | Página de FBref | Comando |
   |---|---|
   | `fbref.com/en/comps/<ID>/stats/` | `bajarTabla("stats_standard", "fbref_general.csv")` |
   | `fbref.com/en/comps/<ID>/misc/` | `bajarTabla("stats_misc", "fbref_defensa.csv")` |
   | `fbref.com/en/comps/<ID>/shooting/` | `bajarTabla("stats_shooting", "fbref_tiros.csv")` |
   | `fbref.com/en/comps/<ID>/keepers/` | `bajarTabla("stats_keeper", "fbref_arqueros.csv")` |

   IDs de competición en FBref: Argentina 21, Brasil 24, Colombia 41, Uruguay 45, Chile 35,
   México 31, MLS 22 (verificar en la URL de FBref: `/comps/<ID>/`).
   Algunas ligas tienen menos estadísticas; si una tabla viene vacía, el conversor usa 0.
3. **equipos.csv:** una fila por equipo con `nombre_fbref;nombre;id_apifootball`.
   El `nombre_fbref` tiene que ser exactamente como aparece en la columna "team" de FBref.
   El conversor avisa si falta alguno.
4. **Fotos (opcional):** bajar los planteles de API-Football (`players/squads?team=<id>`) y guardarlos en
   `apifootball_planteles.csv` con el formato `equipo_id|jugador|foto_id`.
   El plan gratis permite 10 consultas por minuto y 100 por día (alcanza para una liga por día).
   Sin este archivo la app funciona igual: muestra iniciales y considera que todos siguen en el club.
5. **Tablas de posiciones (opcional):** en la página principal de la liga en FBref
   (`fbref.com/en/comps/<ID>/`) las tablas terminan en `_overall`. Bajarlas con `bajarTabla("<id de la tabla>", "fbref_posiciones_<nombre>.csv")`
   y listarlas en `tablas.csv` con el formato `archivo;competencia;grupo` (ver el de Argentina).
6. **Generar:** `node datos/convertir.js <liga>`
7. **Activar:** en `ligas.js`, poner `disponible: true` y la fecha en `actualizado`.

## Limitaciones conocidas

- FBref no publica pases para estas ligas, así que la ficha no mide la distribución del juego.
- Las fotos cubren a los jugadores del plantel actual. Los que se fueron quedan con sus iniciales.
- Los datos no se actualizan solos: hay que repetir el proceso de actualización.

---

© 2026 Scouteando. Todos los derechos reservados sobre el código y el diseño. Los datos pertenecen a sus fuentes (FBref, API-Football).
