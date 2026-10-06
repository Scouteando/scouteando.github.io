// HERRAMIENTA: baja en UN solo archivo todas las tablas de FBref que usa una liga.
//
// Se corre en la consola de cualquier página de fbref.com:
//   paqueteLiga(21, "argentina")      (21 = id de la competición en FBref)
//
// Abre (en segundo plano, sin cambiar de página) las 4 tablas de jugadores
// (stats, misc, shooting, keepers) y la página principal de la liga (posiciones),
// y descarga paquete_<liga>.json con cada tabla convertida a CSV.
// Después: node datos/desarmar_paquete.js paquete_<liga>.json

async function paqueteLiga(comp, liga) {
  const base = "https://fbref.com/en/comps/" + comp + "/";
  const paginas = { "": null, "stats/": "stats_standard", "misc/": "stats_misc", "shooting/": "stats_shooting", "keepers/": "stats_keeper" };
  const salida = { liga, comp, bajado: new Date().toISOString(), tablas: {} };

  const aCsv = function (tabla) {
    const columnas = [...tabla.querySelectorAll("thead tr:last-child th")].map(th => th.getAttribute("data-stat"));
    const filas = [...tabla.querySelectorAll("tbody tr:not(.thead)")].map(tr =>
      columnas.map(function (col) {
        let valor = (tr.querySelector('[data-stat="' + col + '"]')?.textContent || "").trim();
        if (col === "nationality") valor = (valor.match(/[A-Z]{2,3}$/) || [valor])[0]; // "ar ARG" -> "ARG"
        return valor.replace(/[;\n]/g, " ").replace(/(\d)[,\s](\d{3})\b/g, "$1$2");
      }).join(";"));
    return columnas.join(";") + "\n" + filas.join("\n");
  };
  const buscarTablas = function (doc) {
    // Las tablas pueden estar dentro de comentarios HTML: las sacamos de ahí también
    const encontradas = [...doc.querySelectorAll("table[id]")];
    const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_COMMENT);
    let c;
    while ((c = it.nextNode())) {
      if (c.data.includes("<table")) {
        const div = doc.createElement("div");
        div.innerHTML = c.data;
        encontradas.push(...div.querySelectorAll("table[id]"));
      }
    }
    return encontradas;
  };

  for (const [ruta, idJugadores] of Object.entries(paginas)) {
    const html = await fetch(base + ruta, { credentials: "include" }).then(r => r.text());
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const t of buscarTablas(doc)) {
      const esPosiciones = ruta === "" && /^results/.test(t.id);
      if (t.id === idJugadores || esPosiciones) {
        salida.tablas[t.id] = { titulo: (t.querySelector("caption")?.textContent || "").trim(), csv: aCsv(t) };
      }
    }
    await new Promise(ok => setTimeout(ok, 3500)); // despacio, para no cargar a FBref
  }

  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([JSON.stringify(salida)], { type: "application/json" }));
  enlace.download = "paquete_" + liga + ".json";
  document.body.appendChild(enlace);
  enlace.click();
  return Object.entries(salida.tablas).map(([id, t]) => id + " (" + (t.csv.split("\n").length - 1) + " filas) " + t.titulo).join(" | ");
}
