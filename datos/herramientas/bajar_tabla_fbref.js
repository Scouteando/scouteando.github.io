// HERRAMIENTA: descarga una tabla de jugadores de FBref como CSV.
//
// Cómo se usa:
//   1. Abrí en Chrome la página de la tabla en FBref (ver README.md, "Cómo agregar una liga").
//   2. Abrí la consola (F12 -> pestaña "Consola"), pegá TODO este archivo y apretá Enter.
//   3. Escribí, por ejemplo:  bajarTabla("stats_standard", "fbref_general.csv")
//   4. El archivo se descarga a tu carpeta Descargas. Movelo a datos/fuentes/<liga>/.
//
// Tablas y nombres de archivo que usa el proyecto:
//   página /stats/     -> bajarTabla("stats_standard", "fbref_general.csv")
//   página /misc/      -> bajarTabla("stats_misc",     "fbref_defensa.csv")
//   página /shooting/  -> bajarTabla("stats_shooting", "fbref_tiros.csv")
//   página /keepers/   -> bajarTabla("stats_keeper",   "fbref_arqueros.csv")

function bajarTabla(id, archivo) {
  // FBref a veces esconde las tablas dentro de comentarios HTML: las buscamos también ahí
  let tabla = document.querySelector("#" + id);
  if (!tabla) {
    const it = document.createNodeIterator(document.body, NodeFilter.SHOW_COMMENT);
    let comentario;
    while ((comentario = it.nextNode())) {
      if (comentario.data.includes('id="' + id + '"')) {
        const div = document.createElement("div");
        div.innerHTML = comentario.data;
        tabla = div.querySelector("#" + id);
        break;
      }
    }
  }
  if (!tabla) return "No encontré la tabla " + id + " en esta página";

  // Nombres de columna = atributo data-stat de cada encabezado
  const columnas = [...tabla.querySelectorAll("thead tr:last-child th")].map(th => th.getAttribute("data-stat"));
  const filas = [...tabla.querySelectorAll("tbody tr:not(.thead)")].map(tr =>
    columnas.map(function (col) {
      let valor = (tr.querySelector('[data-stat="' + col + '"]')?.innerText || "").trim();
      if (col === "nationality") valor = valor.split(" ").pop();            // "ar ARG" -> "ARG"
      return valor.replace(/[;\n]/g, " ").replace(/(\d)[,\s](\d{3})\b/g, "$1$2"); // "1,734" -> "1734"
    }).join(";")
  );

  const contenido = "﻿" + columnas.join(";") + "\n" + filas.join("\n");
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([contenido], { type: "text/csv" }));
  enlace.download = archivo;
  document.body.appendChild(enlace);
  enlace.click();
  return `Descargado ${archivo} (${filas.length} jugadores)`;
}
