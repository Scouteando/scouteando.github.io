// PORTADA: arma datos/generados/portada.js con los destacados de cada liga
// (goleador, asistidor, Sub-21 con más goles + asistencias y candidatos a "jugador del día").
// Es un archivo chico para que la portada cargue rápido sin bajar todas las ligas.
//
// Uso (después de convertir las ligas):  node datos/portada.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ventana = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "ligas.js"), "utf-8") + ";window.LIGAS = LIGAS;", ventana);
const ligas = ventana.window.LIGAS.filter(l => l.disponible);

// Une a un jugador que jugó en dos clubes de la misma liga (igual que la app)
function unificar(lista) {
  const por = {};
  for (const j of lista) {
    const k = j.nombre + "|" + j.edad;
    if (!por[k]) { por[k] = { ...j }; continue; }
    for (const c of ["partidos", "minutos", "goles", "asistencias"]) por[k][c] += j[c];
    if (j.enPlantel) { por[k].equipo = j.equipo; por[k].equipoId = j.equipoId; }
    por[k].foto = por[k].foto || j.foto;
  }
  return Object.values(por);
}
const resumen = j => ({ nombre: j.nombre, edad: j.edad, equipo: j.equipo, equipoId: j.equipoId, puesto: j.puesto, foto: j.foto || null,
  goles: j.goles, asistencias: j.asistencias, minutos: j.minutos, partidos: j.partidos });

const portada = {};
for (const liga of ligas) {
  const archivo = path.join(__dirname, "generados", liga.id + ".js");
  if (!fs.existsSync(archivo)) continue;
  const caja = { window: {} };
  vm.runInNewContext(fs.readFileSync(archivo, "utf-8"), caja);
  const todos = unificar(caja.window.DATOS_LIGAS[liga.id]);
  const orden = (f, filtro = () => true) => todos.filter(filtro).sort((a, b) => f(b) - f(a) || b.minutos - a.minutos);
  portada[liga.id] = {
    goleador: resumen(orden(j => j.goles)[0]),
    asistidor: resumen(orden(j => j.asistencias)[0]),
    sub21: resumen(orden(j => j.goles + j.asistencias, j => j.edad != null && j.edad <= 21 && j.minutos >= 450)[0]),
    // Candidatos a "jugador del día": los que más goles + asistencias hacen cada 90' (900' o más)
    candidatos: orden(j => (j.goles + j.asistencias) / j.minutos, j => j.minutos >= 900 && j.puesto !== "ARQ").slice(0, 10).map(resumen)
  };
}

const salida = path.join(__dirname, "generados", "portada.js");
fs.writeFileSync(salida, "// ARCHIVO GENERADO por datos/portada.js — no editar a mano.\nwindow.PORTADA = " + JSON.stringify(portada) + ";\n", "utf-8");
console.log("Listo: destacados de " + Object.keys(portada).join(", ") + " -> " + path.relative(process.cwd(), salida) + " (" + fs.statSync(salida).size + " bytes)");
