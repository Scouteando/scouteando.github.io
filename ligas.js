// CONFIGURACIÓN DE LIGAS
// hasta = hasta qué fecha del torneo llegan los datos (se muestra en la portada; actualizarlo junto con "actualizado")
// bandera = código de país de 2 letras (la imagen sale de flagcdn.com)
// Cada liga que muestra la app. Para sumar una liga nueva:
//   1) cargá sus datos en datos/fuentes/<id>/ y generá el archivo con el conversor
//   2) agregala acá con disponible: true
// (ver README.md, sección "Cómo agregar una liga")

const LIGAS = [
  { id: "argentina", nombre: "Liga Profesional", pais: "Argentina", bandera: "ar", temporada: "2026", actualizado: "06/10/2026", hasta: "Clausura, hasta la fecha 10", disponible: true },
  { id: "brasil",    nombre: "Brasileirão Série A", pais: "Brasil",   bandera: "br", temporada: "2026", disponible: true, actualizado: "06/10/2026", hasta: "Hasta la fecha 28" },
  { id: "uruguay",   nombre: "Liga AUF",            pais: "Uruguay",  bandera: "uy", temporada: "2026", disponible: false },
  { id: "colombia",  nombre: "Liga BetPlay",        pais: "Colombia", bandera: "co", temporada: "2026", disponible: true, actualizado: "06/10/2026", hasta: "Finalización, hasta la fecha 13" },
  { id: "chile",     nombre: "Liga de Primera",     pais: "Chile",    bandera: "cl", temporada: "2026", disponible: true, actualizado: "06/10/2026", hasta: "Hasta la fecha 23" },
  { id: "mexico",    nombre: "Liga MX",             pais: "México",   bandera: "mx", temporada: "2026", disponible: true, actualizado: "06/10/2026", hasta: "Apertura, hasta la fecha 10" },
  { id: "mls",       nombre: "MLS",                 pais: "Estados Unidos", bandera: "us", temporada: "2026", disponible: true, actualizado: "06/10/2026", hasta: "Temporada regular, hasta la fecha 28" }
];
