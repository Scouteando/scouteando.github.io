// Desarma un paquete_<liga>.json (bajado con datos/herramientas/paquete_liga.js) en los CSV que usa convertir.js.
//   node datos/desarmar_paquete.js <ruta/paquete_liga.json>
// Las tablas de jugadores van a su archivo fijo. Las de posiciones se guardan según
// datos/fuentes/<liga>/posiciones.csv (id_fbref;archivo); si una tabla no figura ahí, se avisa.
const fs = require("fs");
const path = require("path");

const paquete = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const carpeta = path.join(__dirname, "fuentes", paquete.liga);
const fijos = { stats_standard: "fbref_general.csv", stats_misc: "fbref_defensa.csv", stats_shooting: "fbref_tiros.csv", stats_keeper: "fbref_arqueros.csv" };

const mapa = {};
const archivoMapa = path.join(carpeta, "posiciones.csv");
if (fs.existsSync(archivoMapa)) {
  for (const linea of fs.readFileSync(archivoMapa, "utf8").trim().split("\n").slice(1)) {
    const [id, archivo] = linea.split(";");
    mapa[id.trim()] = archivo.trim();
  }
}

for (const [id, t] of Object.entries(paquete.tablas)) {
  const archivo = fijos[id] || mapa[id];
  if (!archivo) { console.log(`  (sin usar) ${id}: ${t.titulo}`); continue; }
  fs.writeFileSync(path.join(carpeta, archivo), "﻿" + t.csv);
  console.log(`  ${archivo} <- ${id} (${t.csv.split("\n").length - 1} filas)`);
}
console.log(`Listo: ${paquete.liga}, bajado ${paquete.bajado}`);
