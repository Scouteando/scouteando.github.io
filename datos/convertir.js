// CONVERSOR DE DATOS
// Toma las tablas "crudas" de una liga (carpeta datos/fuentes/<liga>/) y genera
// el archivo que usa la app (datos/generados/<liga>.js).
//
// Uso (en la terminal, parado en la carpeta scouting-app):
//   node datos/convertir.js argentina
//
// Archivos que espera en datos/fuentes/<liga>/ (ver README.md):
//   fbref_general.csv     -> partidos, minutos, goles, asistencias, penales, tarjetas
//   fbref_defensa.csv     -> intercepciones, quites, faltas recibidas y cometidas, centros, fuera de juego, autogoles
//   fbref_tiros.csv       -> tiros y tiros al arco
//   fbref_arqueros.csv    -> atajadas, vallas invictas, goles recibidos, tiros recibidos, penales, resultados
//   equipos.csv           -> nombre del equipo en FBref, nombre a mostrar, id en API-Football
//   apifootball_planteles.csv (opcional) -> plantel actual con id de foto
//   apifootball_fisico.csv (opcional) -> altura y peso (id|nombre|altura|peso)
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

// Nombres que se escriben distinto en FBref y en API-Football y no se pueden adivinar
// (ej. "Memphis" en FBref es "M. Depay" en API-Football): alias.csv con nombre_fbref|nombre_api
const alias = {};
for (const x of leerCsv("alias.csv", "|") || []) alias[x.nombre_fbref] = simple(x.nombre_api);

// Distancia de edición (cuántas letras hay que cambiar para pasar de un nombre al otro)
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Pasadas, de la más segura a la más flexible (en las flexibles solo vale si hay UN candidato):
//  1. alias o coincidencia clara      2. mismo apellido (último)
//  3. inicial + apellido en cualquier lugar ("Lucas Martínez Quarta" = "L. Martinez")
//  4. casi igual, error de tipeo ("Facundo Guch" = "Facundo Gauch")
//  5. inicial + primer apellido, cuando API trae los dos apellidos ("Santiago Alzate" = "S. Alzate Uribe")
const fotoDe = {};
const sigueEnElClub = {};
for (const pasada of [1, 2, 3, 4, 5]) {
  for (const f of general) {
    if (fotoDe[clave(f)]) continue;
    const plantel = planteles[(equipos[f.team] || {}).id_apifootball] || [];
    const libres = plantel.filter(p => !p.usado);
    const fb = simple(f.player);
    const tokens = fb.split(" ");
    let candidato;
    let mismos = [];
    if (pasada === 1) {
      candidato = alias[f.player] ? libres.find(p => p.nombre === alias[f.player]) : libres.find(p => coincide(f.player, p.nombre));
    } else if (pasada === 2) {
      mismos = libres.filter(p => p.nombre.split(" ").pop() === tokens[tokens.length - 1]);
    } else if (pasada === 3) {
      mismos = libres.filter(function (p) {
        const partes = p.nombre.split(" ");
        const inicial = partes.find(t => t.endsWith("."));
        const apellidos = partes.filter(t => !t.endsWith(".") && t.length > 2);
        return apellidos.length > 0 && apellidos.every(t => tokens.includes(t)) && (!inicial || inicial[0] === fb[0]);
      });
    } else if (pasada === 4) {
      mismos = libres.filter(p => !p.nombre.includes(".") && distancia(fb, p.nombre) <= 2);
    } else {
      mismos = libres.filter(function (p) {
        const partes = p.nombre.split(" ");
        const inicial = partes.find(t => t.endsWith("."));
        const primerApellido = partes.find(t => !t.endsWith(".") && t.length > 2);
        return inicial && inicial[0] === fb[0] && primerApellido && tokens.slice(1).includes(primerApellido);
      });
    }
    if (pasada > 1 && mismos.length === 1) candidato = mismos[0];
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

// Altura y peso (opcional): apifootball_fisico.csv con id|nombre|altura|peso
const fisico = {};
for (const x of leerCsv("apifootball_fisico.csv", "|") || []) fisico[x.id] = x;
for (const x of leerCsv("fisico_extra_" + liga + ".csv", "|") || []) if (x.altura) fisico[x.id] = x;

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
    penalesConvertidos: num(f.pens_made),
    penalesPateados: num(f.pens_att),
    faltasCometidas: num(d.fouls),
    fueraDeJuego: num(d.offsides),
    autogoles: num(d.own_goals),
    dobleAmarilla: num(d.cards_yellow_red),
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
    j.tirosRecibidos = num(a.gk_shots_on_target_against);
    j.penalesEnContra = num(a.gk_pens_att);
    j.penalesAtajados = num(a.gk_pens_saved);
    j.ganados = num(a.gk_wins);
    j.empatados = num(a.gk_ties);
    j.perdidos = num(a.gk_losses);
  }
  if (fotoDe[clave(f)]) j.foto = fotoDe[clave(f)];
  // Altura y peso: se cruzan por el id del jugador en API-Football (el mismo número de la foto)
  const idApi = (j.foto || "").match(/players\/(\d+)\.png/);
  const fis = idApi && fisico[idApi[1]];
  if (fis) {
    if (fis.altura) j.altura = Number(fis.altura);
    if (fis.peso) j.peso = Number(fis.peso);
  }
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

// ---------- 4b. Lo que pasó en la última fecha (para el "Equipo de la fecha") ----------
// Comparamos con el archivo generado la vez anterior: lo que cada jugador sumó desde entonces.
// Si no cambió nada (ej. se volvió a generar sin datos nuevos), conservamos la fecha anterior.
let fecha = null;
const hoy = new Date().toLocaleDateString("es-AR");
if (fs.existsSync(salida)) {
  const anterior = fs.readFileSync(salida, "utf-8");
  const caja = { window: {} };
  try { require("vm").runInNewContext(anterior, caja); } catch (e) { /* archivo viejo ilegible: se ignora */ }
  const previos = (caja.window.DATOS_LIGAS || {})[liga] || [];
  const fechaPrevia = (caja.window.DATOS_FECHA || {})[liga] || null;
  const desde = (anterior.match(/generado el (\S+)/) || [])[1] || "?";
  const porClave = {};
  for (const j of previos) porClave[j.nombre + "|" + j.equipo + "|" + j.edad] = j;
  const campos = ["partidos", "minutos", "goles", "asistencias", "amarillas", "rojas", "quites", "intercepciones",
    "tirosAlArco", "faltasRecibidas", "centros", "atajadas", "vallasInvictas", "golesRecibidos"];
  const sumaron = [];
  for (const j of jugadores) {
    const antes = porClave[j.nombre + "|" + j.equipo + "|" + j.edad];
    if (!antes || j.minutos <= antes.minutos) continue;
    const d = { nombre: j.nombre, equipo: j.equipo, equipoId: j.equipoId, edad: j.edad, puesto: j.puesto, foto: j.foto };
    for (const c of campos) d[c] = (j[c] || 0) - (antes[c] || 0);
    sumaron.push(d);
  }
  fecha = sumaron.length ? { desde, hasta: hoy, jugadores: sumaron } : fechaPrevia;

  // Historial: guardamos cada fecha nueva (para mostrar después la "forma reciente" de cada jugador)
  if (sumaron.length) {
    const archivoHist = path.join(__dirname, "historial", liga + ".json");
    fs.mkdirSync(path.dirname(archivoHist), { recursive: true });
    const hist = fs.existsSync(archivoHist) ? JSON.parse(fs.readFileSync(archivoHist, "utf-8")) : { campos, fechas: [] };
    if (!hist.fechas.some(f => f.hasta === hoy)) {
      const jugadoresFecha = {};
      for (const d of sumaron) jugadoresFecha[d.nombre + "|" + d.edad] = campos.map(c => d[c]);
      hist.fechas.push({ desde, hasta: hoy, jugadores: jugadoresFecha });
      fs.writeFileSync(archivoHist, JSON.stringify(hist));
      console.log(`Historial: ${hist.fechas.length} fecha(s) guardadas en ${path.relative(process.cwd(), archivoHist)}`);
    }
  }
}

// ---------- 5. Escritura del archivo para la app ----------
const conFoto = jugadores.filter(j => j.foto).length;
const conAltura = jugadores.filter(j => j.altura).length;
const encabezado =
  "// ARCHIVO GENERADO AUTOMÁTICAMENTE por datos/convertir.js — no editar a mano.\n" +
  "// Liga: " + liga + " · generado el " + new Date().toLocaleDateString("es-AR") + "\n\n";
const cuerpo =
  "window.DATOS_LIGAS = window.DATOS_LIGAS || {};\n" +
  "window.DATOS_LIGAS[" + JSON.stringify(liga) + "] = [\n" +
  jugadores.map(j => "  " + JSON.stringify(j)).join(",\n") +
  "\n];\n" +
  "window.DATOS_TABLAS = window.DATOS_TABLAS || {};\n" +
  "window.DATOS_TABLAS[" + JSON.stringify(liga) + "] = " + JSON.stringify(tablas) + ";\n" +
  "window.DATOS_FECHA = window.DATOS_FECHA || {};\n" +
  "window.DATOS_FECHA[" + JSON.stringify(liga) + "] = " + JSON.stringify(fecha) + ";\n";

fs.writeFileSync(salida, encabezado + cuerpo, "utf-8");
console.log(`Listo: ${jugadores.length} jugadores de "${liga}" (${conFoto} con foto, ${conAltura} con altura) -> ${path.relative(process.cwd(), salida)}`);
const sinEquipo = [...new Set(general.filter(f => !equipos[f.team]).map(f => f.team))];
if (sinEquipo.length) console.log("Ojo: equipos sin cargar en equipos.csv:", sinEquipo.join(", "));
