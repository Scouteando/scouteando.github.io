// CONVERSOR DE DATOS
// Toma las tablas "crudas" de una liga (carpeta datos/fuentes/<liga>/) y genera
// el archivo que usa la app (datos/generados/<liga>.js).
//
// Uso (en la terminal, parado en la carpeta scouting-app):
//   node datos/convertir.js argentina
//
// Archivos que espera en datos/fuentes/<liga>/ (ver README.md):
//   fbref_general.csv     -> partidos, minutos, goles, asistencias, tarjetas
//   fbref_defensa.csv     -> intercepciones, quites, faltas recibidas, centros
//   fbref_tiros.csv       -> tiros y tiros al arco
//   fbref_arqueros.csv    -> atajadas, vallas invictas, goles recibidos
//   equipos.csv           -> nombre del equipo en FBref, nombre a mostrar, id en API-Football
//   apifootball_planteles.csv (opcional) -> plantel actual con id de foto
//   tablas.csv (opcional) -> lista de tablas de posiciones (archivo;competencia;grupo;zonas)
//     zonas: puestos que clasifican o descienden, ej. 1-4:lib,5-6:prelib,7-12:sud,17-20:desc,1-8:play

const fs = require("fs");
const path = require("path");

const liga = process.argv[2];
if (!liga) {
  console.log("Falta el nombre de la liga. Ejemplo: node datos/convertir.js argentina");
  process.exit(1);
}
const carpeta = path.join(__dirname, "fuentes", liga);
const salida = path.join(__dirname, "generados", liga + ".js");

// ---------- 1. Lectura de CSV ----------
// Devuelve una lista de objetos usando la primera fila como nombres de columna.
function leerCsv(archivo, separador = ";") {
  const ruta = path.join(carpeta, archivo);
  if (!fs.existsSync(ruta)) return null;
  const lineas = fs.readFileSync(ruta, "utf-8").replace(/^﻿/, "").trim().split(/\r?\n/);
  const columnas = lineas.shift().split(separador);
  return lineas.map(function (linea) {
    const valores = linea.split(separador);
    const fila = {};
    columnas.forEach((c, i) => { fila[c] = (valores[i] || "").trim(); });
    return fila;
  });
}

const num = texto => (texto === "" || texto == null ? 0 : Number(String(texto).replace(/[\s,]/g, "")));
const clave = fila => fila.player + "|" + fila.team; // un jugador en un equipo

const general = leerCsv("fbref_general.csv");
if (!general) {
  console.log("No encontré " + path.join(carpeta, "fbref_general.csv"));
  process.exit(1);
}

// Tablas complementarias en "diccionarios" por jugador|equipo
function indexar(filas) {
  const dic = {};
  for (const f of filas || []) dic[clave(f)] = f;
  return dic;
}
const defensa = indexar(leerCsv("fbref_defensa.csv"));
const tiros = indexar(leerCsv("fbref_tiros.csv"));
const arqueros = indexar(leerCsv("fbref_arqueros.csv"));

const equipos = {};
for (const e of leerCsv("equipos.csv") || []) equipos[e.nombre_fbref] = e;

// ---------- 2. Fotos y plantel actual (API-Football) ----------
function simple(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z. ]/g, "").trim();
}

const planteles = {}; // id de equipo -> [{ nombre, id, usado }]
for (const p of leerCsv("apifootball_planteles.csv", "|") || []) {
  (planteles[p.equipo_id] = planteles[p.equipo_id] || []).push({ nombre: simple(p.jugador), id: p.foto_id, usado: false });
}

// ¿"L. Paredes" es "Leandro Paredes"?
function coincide(nombreFbref, nombreApi) {
  const f = simple(nombreFbref).split(" ");
  const a = nombreApi.split(" ");
  const iniciales = a.filter(t => t.endsWith("."));
  const resto = a.filter(t => !t.endsWith("."));
  if (resto.length === 0) return false;
  if (iniciales.length > 0) {
    return f.join(" ").endsWith(resto.join(" ")) && f[0][0] === iniciales[0][0];
  }
  return resto.every(t => f.includes(t)) || f.every(t => resto.includes(t)) ||
         (resto[0] === f[0] && resto[resto.length - 1] === f[f.length - 1]);
}

// Tres pasadas: coincidencia clara, apellido único en el plantel, y reusar foto si cambió de club
const fotoDe = {};
const sigueEnElClub = {};
for (const pasada of [1, 2]) {
  for (const f of general) {
    if (fotoDe[clave(f)]) continue;
    const plantel = planteles[(equipos[f.team] || {}).id_apifootball] || [];
    let candidato;
    if (pasada === 1) {
      candidato = plantel.find(p => !p.usado && coincide(f.player, p.nombre));
    } else {
      const apellido = simple(f.player).split(" ").pop();
      const mismos = plantel.filter(p => !p.usado && p.nombre.split(" ").pop() === apellido);
      if (mismos.length === 1) candidato = mismos[0];
    }
    if (candidato) {
      candidato.usado = true;
      fotoDe[clave(f)] = "https://media.api-sports.io/football/players/" + candidato.id + ".png";
      sigueEnElClub[clave(f)] = true;
    }
  }
}
for (const f of general) {
  if (fotoDe[clave(f)]) continue;
  const otro = general.find(g => g !== f && g.player === f.player && g.age === f.age && fotoDe[clave(g)]);
  if (otro) fotoDe[clave(f)] = fotoDe[clave(otro)];
}

// ---------- 3. Armado de cada jugador ----------
const puestos = { GK: "ARQ", DF: "DEF", MF: "MED", FW: "DEL" };
const hayPlanteles = Object.keys(planteles).length > 0;

const jugadores = general.map(function (f) {
  const d = defensa[clave(f)] || {};
  const t = tiros[clave(f)] || {};
  const equipo = equipos[f.team] || {};
  const puesto = puestos[f.position.split(/[ ,]/)[0]] || "S/D";

  const j = {
    nombre: f.player,
    equipo: equipo.nombre || f.team,
    equipoId: equipo.id_apifootball ? Number(equipo.id_apifootball) : null,
    puesto: puesto,
    puestoOriginal: f.position,
    pais: f.nationality || "-",
    edad: f.age ? parseInt(f.age.split("-")[0]) : null, // "22-180" = 22 años y 180 días
    partidos: num(f.games),
    titular: num(f.games_starts),
    minutos: num(f.minutes),
    goles: num(f.goals),
    asistencias: num(f.assists),
    amarillas: num(f.cards_yellow),
    rojas: num(f.cards_red),
    intercepciones: num(d.interceptions),
    quites: num(d.tackles_won),
    faltasRecibidas: num(d.fouled),
    centros: num(d.crosses),
    tiros: num(t.shots),
    tirosAlArco: num(t.shots_on_target),
    // Si no tenemos planteles cargados, asumimos que todos siguen en el club
    // Si no tenemos el plantel de ESE equipo (ej. un ascendido que no está en API-Football),
    // asumimos que sigue en el club para no esconderlo
    enPlantel: hayPlanteles && planteles[equipo.id_apifootball] ? sigueEnElClub[clave(f)] === true : true
  };

  if (puesto === "ARQ") {
    const a = arqueros[clave(f)] || {};
    j.golesRecibidos = num(a.gk_goals_against);
    j.atajadas = num(a.gk_saves);
    j.pctAtajadas = num(a.gk_save_pct);
    j.vallasInvictas = num(a.gk_clean_sheets);
  }
  if (fotoDe[clave(f)]) j.foto = fotoDe[clave(f)];
  return j;
});

// ---------- 4. Tablas de posiciones (opcional: tablas.csv lista los archivos) ----------
const tablas = (leerCsv("tablas.csv") || []).map(function (t) {
  const filas = leerCsv(t.archivo) || [];
  return {
    competencia: t.competencia,
    grupo: t.grupo,
    // zonas: "1-4:lib,7-12:sud,17-20:desc" -> [{ desde: 1, hasta: 4, tipo: "lib" }, ...]
    zonas: (t.zonas || "").split(",").filter(Boolean).map(z => {
      const [rango, tipo] = z.split(":");
      const [desde, hasta] = rango.split("-").map(Number);
      return { desde, hasta: hasta || desde, tipo };
    }),
    filas: filas.map(f => ({
      pos: num(f.rank),
      equipo: (equipos[f.team] || {}).nombre || f.team,
      equipoId: (equipos[f.team] || {}).id_apifootball ? Number(equipos[f.team].id_apifootball) : null,
      pj: num(f.games), g: num(f.wins), e: num(f.ties), p: num(f.losses),
      gf: num(f.goals_for), gc: num(f.goals_against), dg: num(f.goals_for) - num(f.goals_against),
      pts: num(f.points), promedio: Number(f.points_avg) || 0,
      ultimos: (f.last_5 || "").split(" ").filter(Boolean).map(r => ({ W: "G", D: "E", L: "P" }[r] || r))
    }))
  };
});

// ---------- 5. Escritura del archivo para la app ----------
const conFoto = jugadores.filter(j => j.foto).length;
const encabezado =
  "// ARCHIVO GENERADO AUTOMÁTICAMENTE por datos/convertir.js — no editar a mano.\n" +
  "// Liga: " + liga + " · generado el " + new Date().toLocaleDateString("es-AR") + "\n\n";
const cuerpo =
  "window.DATOS_LIGAS = window.DATOS_LIGAS || {};\n" +
  "window.DATOS_LIGAS[" + JSON.stringify(liga) + "] = [\n" +
  jugadores.map(j => "  " + JSON.stringify(j)).join(",\n") +
  "\n];\n" +
  "window.DATOS_TABLAS = window.DATOS_TABLAS || {};\n" +
  "window.DATOS_TABLAS[" + JSON.stringify(liga) + "] = " + JSON.stringify(tablas) + ";\n";

fs.writeFileSync(salida, encabezado + cuerpo, "utf-8");
console.log(`Listo: ${jugadores.length} jugadores de "${liga}" (${conFoto} con foto) -> ${path.relative(process.cwd(), salida)}`);
const sinEquipo = [...new Set(general.filter(f => !equipos[f.team]).map(f => f.team))];
if (sinEquipo.length) console.log("Ojo: equipos sin cargar en equipos.csv:", sinEquipo.join(", "));
