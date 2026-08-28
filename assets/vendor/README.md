# Librerías auto-alojadas

Copias locales, sin modificar, de las librerías que antes se cargaban en
caliente desde un CDN. Viven aquí (en vez de tirar de `cdnjs`/`jsdelivr` en
cada carga) para que:

- La app siga funcionando **sin conexión** una vez cacheada por el Service
  Worker (`sw.js`) - crítico para algo pensado para usarse en un iPad/tablet.
- No dependa de que el CDN externo siga en línea o accesible en la red del
  usuario.

| Archivo | Versión | Origen |
|---|---|---|
| `three.min.js` | r128 | https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js |
| `OrbitControls.js` | r128 (examples) | https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js |
| `tween.umd.js` | 18.6.4 | https://cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.umd.js |
| `chess.min.js` | 0.10.3 | https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js |
| `stockfish.min.js` | 10.0.2 (build asm.js, un solo archivo, sin `.wasm` separado) | https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.min.js |
| `firebase/firebase-app.js` | 10.14.1 | https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js |
| `firebase/firebase-auth.js` | 10.14.1 | https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js |
| `firebase/firebase-firestore.js` | 10.14.1 | https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js |

Cada una conserva la licencia de su proyecto original (MIT en los cinco
primeros casos, Apache-2.0 en Firebase). Para actualizar una versión:
descargar el archivo nuevo del mismo origen y reemplazar aquí; si cambia la
ruta del `.wasm` de Stockfish (otra versión sí lo separa), hay que copiar
también ese archivo y ajustar `js/stockfish-worker.js`.

**Nota sobre los archivos de Firebase**: `firebase-auth.js` y
`firebase-firestore.js` traen de fábrica un `import` a
`firebase-app.js` apuntando al CDN de gstatic en caliente - se reescribió
a mano a una ruta relativa (`./firebase-app.js`) para que los tres
funcionen 100% auto-alojados. Si se actualiza la versión, hay que repetir
ese cambio en los dos archivos (buscar `gstatic.com/firebasejs`).
