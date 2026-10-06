// HERRAMIENTA: completa altura y peso de los jugadores que todavía no la tienen.
//
// Se corre en la consola de dashboard.api-football.com con UNA línea:
//   fetch("https://scouteando.github.io/datos/herramientas/fisico_faltantes.js").then(r=>r.text()).then(t=>{eval(t);bajarFaltantes("TU_CLAVE","argentina")})
//
// - Busca jugador por jugador (los que más minutos jugaron primero).
// - El plan gratis da 100 consultas por día: frena solo cuando se terminan.
// - Lo que ya bajó queda guardado en el navegador, así que al otro día sigue
//   donde quedó. Cada vez descarga fisico_extra_<liga>.csv con TODO lo acumulado.

async function bajarFaltantes(clave, liga) {
  const listas = await fetch("https://scouteando.github.io/datos/faltan-fisico.json").then(r => r.json());
  const ids = listas[liga] || [];
  const llave = "fisicoExtra_" + liga;
  const hechos = JSON.parse(localStorage.getItem(llave) || "{}");
  const pendientes = ids.filter(id => !(id in hechos));
  console.log(liga + ": faltan " + pendientes.length + " de " + ids.length + " jugadores");

  const cm = v => (String(v || "").match(/\d+/) || [""])[0];
  async function pedir(url) {
    const r = await fetch("https://v3.football.api-sports.io/" + url, { headers: { "x-apisports-key": clave } });
    // Si el navegador no deja leer el encabezado, no sabemos cuántas quedan: seguimos hasta que la API dé error
    const h = r.headers.get("x-ratelimit-requests-remaining");
    const quedan = h == null ? Infinity : Number(h);
    return { datos: await r.json(), quedan };
  }

  let usadas = 0;
  for (const id of pendientes) {
    let { datos, quedan } = await pedir("players/profiles?player=" + id);
    usadas++;
    if (datos.errors && Object.keys(datos.errors).length) {
      console.log("Corté acá:", datos.errors);
      break;
    }
    const p = ((datos.response || [])[0] || {}).player || {};
    hechos[id] = [id, p.name || "", cm(p.height), cm(p.weight)].join("|");
    localStorage.setItem(llave, JSON.stringify(hechos));
    console.log(usadas + ". " + (p.name || id) + ": " + (cm(p.height) || "-") + " cm, " + (cm(p.weight) || "-") + " kg");
    if (quedan <= 1) { console.log("Se terminaron las consultas de hoy. Mañana corré la misma línea."); break; }
    await new Promise(ok => setTimeout(ok, 6500));
  }

  const filas = ["id|nombre|altura|peso", ...Object.values(hechos)];
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([filas.join("\n")], { type: "text/csv" }));
  enlace.download = "fisico_extra_" + liga + ".csv";
  document.body.appendChild(enlace);
  enlace.click();
  const conAltura = Object.values(hechos).filter(f => f.split("|")[2]).length;
  return "Listo: " + conAltura + " con altura (" + (ids.length - Object.keys(hechos).length) + " pendientes)";
}
