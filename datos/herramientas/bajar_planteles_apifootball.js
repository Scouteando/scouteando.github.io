// HERRAMIENTA: baja los planteles (con id de foto) de TODOS los equipos de una liga de API-Football.
//
// Cómo se usa (lo corrés vos, con TU clave; no la compartas ni la subas a GitHub):
//   1. En Chrome, abrí dashboard.api-football.com (logueado) y la consola (F12 -> "Consola").
//   2. Pegá TODO este archivo y apretá Enter.
//   3. Escribí:  bajarPlantelesLiga("TU_CLAVE", 239, 2026)   (239 = id de la liga en API-Football)
//      Ids de ligas: Argentina 128, Brasil 71, Colombia 239, Chile 265, México 262, MLS 253, Uruguay 268.
//   4. Tarda ~8 segundos por equipo (el plan gratis permite 10 consultas por minuto y 100 por día).
//      Al final se descarga planteles_liga_<id>.csv: renombralo a apifootball_planteles.csv y
//      movelo a datos/fuentes/<liga>/. La columna "equipo" sirve para armar equipos.csv.

async function bajarPlantelesLiga(clave, liga, temporada) {
  const h = { headers: { "x-apisports-key": clave } };
  const eq = await fetch("https://v3.football.api-sports.io/teams?league=" + liga + "&season=" + temporada, h).then(x => x.json());
  const ids = (eq.response || []).map(e => e.team.id);
  console.log("Equipos encontrados: " + ids.length, JSON.stringify(eq.errors || {}));
  const filas = ["equipo_id|equipo|jugador|foto_id"];
  for (const id of ids) {
    await new Promise(ok => setTimeout(ok, 7500));
    const r = await fetch("https://v3.football.api-sports.io/players/squads?team=" + id, h).then(x => x.json());
    const p = (r.response || [])[0];
    if (!p) { console.log("Sin datos", id, JSON.stringify(r.errors)); continue; }
    for (const j of p.players) filas.push([id, p.team.name, j.name, j.id].join("|"));
    console.log(p.team.name + ": " + p.players.length);
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([filas.join("\n")], { type: "text/csv" }));
  a.download = "planteles_liga_" + liga + ".csv";
  document.body.appendChild(a);
  a.click();
  return "Listo: " + (filas.length - 1) + " jugadores";
}
