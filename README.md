# AJEDREZ ♟️

Ajedrez 3D cinematográfico para navegador (iPad, tablets, móvil y PC), construido con **Three.js** y **chess.js**.

## Características

- Tablero 3D con cámaras dinámicas (panorámica, combate rasante, cenital, lateral) y modo Director.
- Motor de IA: intenta usar **Stockfish real** (vía Web Worker) y cae a un motor propio (minimax + poda alfa-beta) si no está disponible.
- Dificultad adaptativa: el nivel de la IA sube o baja según tus resultados (se guarda en el navegador).
- Relojes de ajedrez duales con varios controles de tiempo (bullet, blitz, rápida, clásica).
- Modo Academia con lecciones guiadas y modo Puzzles.
- Barra de evaluación de posición, historial de jugadas en PGN, piezas capturadas, pista 3D y mapa de amenazas.
- Sonido envolvente y efectos visuales cinematográficos.

## Cómo ejecutarlo

Es una app estática (sin build ni backend). Basta con servir la carpeta con cualquier servidor HTTP y abrir `index.html`, por ejemplo:

```bash
npx serve .
```

## Estructura

```
index.html          Interfaz principal (HUD, modales, pantalla de inicio)
css/                 Estilos (main, tablero/UI, academia, modales)
js/
  main.js            Arranque y orquestación
  board.js           Renderizado 3D del tablero (Three.js)
  engine.js           Motor de IA (Stockfish + fallback casero)
  ai-worker.js         Web Worker del motor de respaldo (minimax)
  stockfish-worker.js  Web Worker que carga Stockfish real
  learning.js          Academia y puzzles
  ui.js                Interacción de interfaz (HUD, relojes, menús)
  audio.js             Sonido y música
  effects.js           Efectos visuales
assets/              Recursos gráficos (SVG de las tarjetas del menú)
```
