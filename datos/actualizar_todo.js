// ACTUALIZACIÓN COMPLETA: toma los paquete_<liga>.json de una carpeta y deja todo listo para publicar.
//   node datos/actualizar_todo.js <carpeta con los paquetes>
// Hace, para cada liga disponible que tenga paquete: desarmar -> convertir. Después arma la portada,
// pone la fecha de hoy en "actualizado", actualiza el número de fecha en "hasta" (partidos jugados
// en la tabla del torneo actual) y sube el ?v= de index.html para que los celulares bajen lo nuevo.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const vm = require("vm");

const carpeta = process.argv[2];
const raiz = path.join(__dirname, "..");
const archivoLigas = path.join(raiz, "ligas.js");
const caja = { window: {} };
vm.runInNewContext(fs.readFileSync(archivoLigas, "utf-8") + ";window.LIGAS = LIGAS;", caja);
const hoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });

let textoLigas = fs.readFileSync(archivoLigas, "utf-8");
for (const liga of caja.window.LIGAS.filter(l => l.disponible)) {
  const paquete = path.join(carpeta, "paquete_" + liga.id + ".json");
  if (!fs.existsSync(paquete)) { console.log(`(sin paquete) ${liga.id}`); continue; }
  console.log(`== ${liga.id}`);
  console.log(execFileSync("node", [path.join(__dirname, "desarmar_paquete.js"), paquete]).toString().trim().split("\n").filter(l => !l.includes("sin usar")).slice(-1)[0]);
  console.log(execFileSync("node", [path.join(__dirname, "convertir.js"), liga.id], { cwd: raiz }).toString().trim().split("\n").slice(-2).join("\n"));

  // Número de fecha: máximo de partidos jugados en la primera tabla (torneo actual)
  const datos = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "generados", liga.id + ".js"), "utf-8"), datos);
  const tablas = (datos.window.DATOS_TABLAS || {})[liga.id] || [];
  const actuales = tablas.filter(t => tablas[0] && t.competencia === tablas[0].competencia);
  const fechaN = actuales.length ? Math.max(...actuales.flatMap(t => t.filas.map(f => f.pj))) : null;
  const re = new RegExp(`(\\{ id: "${liga.id}",[^\\n]*?)actualizado: "[^"]*"`);
  textoLigas = textoLigas.replace(re, `$1actualizado: "${hoy}"`);
  if (fechaN) {
    const reHasta = new RegExp(`(\\{ id: "${liga.id}",[^\\n]*?hasta: "[^"]*?)\\d+(")`);
    textoLigas = textoLigas.replace(reHasta, `$1${fechaN}$2`);
  }
}
fs.writeFileSync(archivoLigas, textoLigas);
console.log(execFileSync("node", [path.join(__dirname, "portada.js")], { cwd: raiz }).toString().trim());

const archivoIndex = path.join(raiz, "index.html");
const index = fs.readFileSync(archivoIndex, "utf-8");
const v = Math.max(...[...index.matchAll(/\?v=(\d+)/g)].map(m => Number(m[1]))) + 1;
fs.writeFileSync(archivoIndex, index.replace(/\?v=\d+/g, "?v=" + v));
console.log(`Listo. ligas.js actualizado al ${hoy}, index.html en ?v=${v}. Falta: git commit y git push.`);
