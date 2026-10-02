// PORTADA: arma datos/generados/portada.js con los destacados de cada liga
// (goleador, asistidor, Sub-21 con más goles + asistencias y la figura de la última fecha).
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
const resumen = j => !j ? null : ({ nombre: j.nombre, edad: j.edad, equipo: j.equipo, equipoId: j.equipoId, puesto: j.puesto, foto: j.foto || null,
  goles: j.goles, asistencias: j.asistencias, minutos: j.minutos, partidos: j.partidos, ahoraEn: j.ahoraEn || null });

// Puntos de la fecha (igual que el "Equipo de la fecha" de la app)
function puntosFecha(d) {
  let p = d.minutos >= 60 ? 2 : 1;
  p += d.goles * ({ ARQ: 6, DEF: 6, MED: 5, DEL: 4 }[d.puesto] || 4) + d.asistencias * 3;
  if (d.puesto === "ARQ" || d.puesto === "DEF") p += (d.vallasInvictas || 0) * 4;
  p += (d.atajadas || 0) * 0.5 + (d.quites + d.intercepciones) * 0.3 + d.tirosAlArco * 0.5;
  p -= d.amarillas + d.rojas * 3;
  return Math.round(p * 10) / 10;
}

// 1) Leemos todas las ligas
const datos = {};
for (const liga of ligas) {
  const archivo = path.join(__dirname, "generados", liga.id + ".js");
  if (!fs.existsSync(archivo)) continue;
  const caja = { window: {} };
  vm.runInNewContext(fs.readFileSync(archivo, "utf-8"), caja);
  datos[liga.id] = { todos: unificar(caja.window.DATOS_LIGAS[liga.id]), fecha: (caja.window.DATOS_FECHA || {})[liga.id] || null };
}

// 2) Dónde juega hoy cada jugador: si se fue de su club pero está en otra liga cargada, sigue contando
const activos = {};
for (const [id, d] of Object.entries(datos)) {
  for (const j of d.todos) if (j.enPlantel) activos[j.nombre + "|" + j.edad] = { liga: id, equipo: j.equipo };
}
const sigueActivo = (j, ligaId) => j.enPlantel || (activos[j.nombre + "|" + j.edad] && activos[j.nombre + "|" + j.edad].liga !== ligaId);
const ahoraEn = (j, ligaId) => (!j.enPlantel && activos[j.nombre + "|" + j.edad]) ? activos[j.nombre + "|" + j.edad].equipo : null;

const portada = {};
for (const liga of ligas) {
  if (!datos[liga.id]) continue;
  // Solo jugadores que siguen en su club (o que ahora juegan en otra de nuestras ligas)
  const todos = datos[liga.id].todos.filter(j => sigueActivo(j, liga.id));
  todos.forEach(j => { j.ahoraEn = ahoraEn(j, liga.id); });
  const orden = (f, filtro = () => true) => todos.filter(filtro).sort((a, b) => f(b) - f(a) || b.minutos - a.minutos);
  // Figura de la fecha: el que más puntos sumó desde la actualización anterior
  const fecha = datos[liga.id].fecha;
  const figura = fecha && fecha.jugadores.length
    ? fecha.jugadores.map(d => ({ ...d, puntos: puntosFecha(d) })).sort((a, b) => b.puntos - a.puntos)[0] : null;
  portada[liga.id] = {
    goleador: resumen(orden(j => j.goles)[0]),
    asistidor: resumen(orden(j => j.asistencias)[0]),
    sub21: resumen(orden(j => j.goles + j.asistencias, j => j.edad != null && j.edad <= 21 && j.minutos >= 450)[0]),
    // Candidatos a "jugador del día": los que más goles + asistencias hacen cada 90' (900' o más)
    figura: figura ? { ...resumen(figura), puntos: figura.puntos, golesFecha: figura.goles, asistFecha: figura.asistencias, desde: fecha.desde, hasta: fecha.hasta } : null
  };
}

const salida = path.join(__dirname, "generados", "portada.js");
fs.writeFileSync(salida, "// ARCHIVO GENERADO por datos/portada.js — no editar a mano.\nwindow.PORTADA = " + JSON.stringify(portada) + ";\n", "utf-8");
console.log("Listo: destacados de " + Object.keys(portada).join(", ") + " -> " + path.relative(process.cwd(), salida) + " (" + fs.statSync(salida).size + " bytes)");
