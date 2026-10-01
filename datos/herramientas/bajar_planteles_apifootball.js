// HERRAMIENTA: baja los planteles (con id de foto) de API-Football como CSV.
//
// Cómo se usa (lo corrés vos, con TU clave; no la compartas ni la subas a GitHub):
//   1. En Chrome, abrí dashboard.api-football.com (logueado) y la consola (F12 -> "Consola").
//   2. Pegá TODO este archivo y apretá Enter.
//   3. Escribí:  bajarPlanteles("TU_CLAVE", [127, 121, ...])   (los id de equipos.csv)
//   4. Tarda ~8 segundos por equipo (el plan gratis permite 10 consultas por minuto).
//      Al final se descarga apifootball_planteles.csv: movelo a datos/fuentes/<liga>/.

async function bajarPlanteles(clave, ids) {
  const filas = ["equipo_id|equipo|jugador|foto_id"];
  for (const id of ids) {
    const r = await fetch("https://v3.football.api-sports.io/players/squads?team=" + id, {
      headers: { "x-apisports-key": clave }
    }).then(x => x.json());
    const plantel = (r.response || [])[0];
    if (!plantel) { console.log("Sin datos para el equipo", id, r.errors); continue; }
    for (const j of plantel.players) filas.push([id, plantel.team.name, j.name, j.id].join("|"));
    console.log(plantel.team.name + ": " + plantel.players.length + " jugadores");
    await new Promise(ok => setTimeout(ok, 7500));
  }
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([filas.join("\n")], { type: "text/csv" }));
  enlace.download = "apifootball_planteles.csv";
  document.body.appendChild(enlace);
  enlace.click();
  return "Listo: " + (filas.length - 1) + " jugadores";
}
