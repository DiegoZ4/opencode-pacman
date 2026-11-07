# SPEC 01 — Cuatro fantasmas con personalidad propia

> **Estado:** Aprobado
> **Depende de:** — (primera spec del proyecto)
> **Fecha:** 2026-10-26
> **Objetivo:** Los 4 fantasmas del corral (blinky, pinky, inky, clyde) tienen cada uno una personalidad de ataque distinta con velocidad y color propios, y blinky persigue agresivamente a Pac-Man de forma directa.

## Por qué existe esta spec

Hoy solo hay 2 fantasmas (`'hunter'` y `'random'` en `GHOST_STARTS`) con IA primitiva. Se quiere el reparto clásico del arcade: 4 personalidades diferenciadas donde una destaca como perseguidor agresivo. `render.js` ya define los 4 colores arcade indexados, así que el dibujo está casi listo.

## Scope

**In:**

- `GHOST_STARTS` (`src/js/maze.js`) pasa de 2 a 4 fantasmas: `blinky`, `pinky`, `inky`, `clyde`, todos naciendo dentro del corral (fila 14).
- Personalidades en `decideGhost()` (`src/js/game.js`), cada kind calcula una celda **objetivo (target)** y un selector voraz común elige la dirección válida sin reversa que minimice la distancia Manhattan al target:
  - `blinky` — agresivo: target = celda de Pac-Man.
  - `pinky` — emboscador: target = celda de Pac-Man + 4 celdas en su dirección actual (sin el overflow bug del arcade).
  - `inky` — flanqueador: target = blinky + 2 × ((pac + 2 delante) − blinky), usando la posición del fantasma `blinky`.
  - `clyde` — tímido: si distancia Manhattan a Pac-Man > 8 → target Pac-Man; si ≤ 8 → target su esquina.
- Velocidad por personalidad en `src/js/game.js`: `GHOST_SPEEDS = { blinky: 1/9, pinky: 1/10, inky: 1/11, clyde: 1/12 }` (sustituye la constante `GHOST_SPEED`).
- Colores ligados al kind en `src/js/render.js`: `GHOST_COLORS` pasa de array por índice a mapa kind→color.
- Actualizar la sección "Ghost AI kinds" de `AGENTS.md` con los 4 kinds.

**Out of scope (para futuras specs):**

- Modos globales scatter/chase con temporizadores.
- Power pellets, modo frightened, comer fantasmas (no existen hoy en el juego).
- Salida escalonada del corral (los 4 salen libremente por la puerta, como ahora).
- Cambios en vidas, score, colisiones, laberinto, Pac-Man o `main.js`.
- Nuevos archivos o conversión a módulos ES.

## Data model

```js
// src/js/maze.js — GHOST_STARTS pasa de 2 a 4 entradas
const GHOST_STARTS = [
  { x: 14, y: 14, kind: 'blinky' }, // rojo, el agresivo
  { x: 13, y: 14, kind: 'pinky' },  // rosa, emboscador
  { x: 12, y: 14, kind: 'inky' },   // cian, flanqueador
  { x: 15, y: 14, kind: 'clyde' },  // naranja, tímido
];

// src/js/game.js — velocidad por kind (sustituye a GHOST_SPEED)
const GHOST_SPEEDS = { blinky: 1 / 9, pinky: 1 / 10, inky: 1 / 11, clyde: 1 / 12 };

// src/js/game.js — esquina de retiro de clyde (inferior izquierda, transitable)
const CLYDE_CORNER = { x: 1, y: 29 };

// src/js/render.js — color ligado al kind (antes: array por índice)
const GHOST_COLORS = {
  blinky: '#ff0000', pinky: '#ffb8ff', inky: '#00ffff', clyde: '#ffb852',
};
```

Convenciones: celdas `(x, y)` con origen arriba-izquierda; velocidades siempre de la forma `1/N` (fracción de celda por frame) para que `aligned()` con ε=1e-3 alinee exactamente; las restas de celdas son componente a componente.

## Plan de implementación

1. `maze.js`: reemplazar `GHOST_STARTS` por las 4 entradas. Verificación manual: abrir `src/index.html` y ver 4 fantasmas en el corral (aún con colores por índice y IA aleatoria, porque `'hunter'` ya no coincide).
2. `game.js`: añadir `GHOST_SPEEDS` y que `createGame()` asigne `speed: GHOST_SPEEDS[g.kind]`; eliminar la constante `GHOST_SPEED`. Manual: blinky se nota más rápido, clyde más lento.
3. `game.js`: reescribir `decideGhost()` — calcular el target según el kind (fórmulas del Scope) y reutilizar el selector voraz actual (no-reversa + 180° en callejón). Añadir `CLYDE_CORNER`. Fallback: si `inky` no encuentra al fantasma `blinky`, se comporta como `blinky`. Manual: blinky va directo a por Pac-Man; pinky corta el paso por delante; clyde da vueltas por la zona inferior izquierda.
4. `render.js`: `GHOST_COLORS` como mapa kind→color y `drawGhost(ctx, g, GHOST_COLORS[g.kind] || '#ff0000')`. Manual: rojo, rosa, cian y naranja sin importar el orden de `GHOST_STARTS`.
5. `AGENTS.md`: actualizar la línea "Ghost AI kinds" con los 4 kinds, personalidades y velocidades.

Cada paso deja el juego ejecutable y es committable por sí solo.

## Criterios de aceptación

- [ ] Al iniciar una partida se ven exactamente 4 fantasmas dentro del corral (fila 14) con colores rojo, rosa, cian y naranja.
- [ ] blinky (rojo) persigue de forma directa: en pasillos despejados reduce persistentemente su distancia a Pac-Man.
- [ ] Cada kind usa su velocidad: blinky 1/9, pinky 1/10, inky 1/11, clyde 1/12 (`GHOST_SPEEDS` en `game.js`).
- [ ] Con Pac-Man detenido contra una pared, pinky (rosa) se dirige a la celda situada 4 posiciones delante de la dirección actual de Pac-Man, no hacia su celda.
- [ ] inky (cian) calcula su objetivo con la posición de blinky (fórmula de flanqueo del Scope); con blinky cerca de Pac-Man, inky se aproxima por un flanco distinto.
- [ ] clyde (naranja) se retira hacia `CLYDE_CORNER` (1,29) cuando está a ≤ 8 celdas Manhattan de Pac-Man, y persigue cuando está más lejos.
- [ ] Los 4 salen del corral por la puerta (fila 12, columnas 13-14) sin bloquearse ni quedarse dentro.
- [ ] Ningún fantasma atraviesa paredes, se congela para siempre ni ignora el túnel (fila 14).
- [ ] Una colisión con cualquier fantasma resta una vida y resetea las 4 posiciones (no el score ni el grid); a la tercera, `'lost'`.
- [ ] Comer todos los dots sigue dando `'won'` con 10 puntos por dot.
- [ ] No hay errores en la consola del navegador durante una partida completa.
- [ ] `AGENTS.md` documenta los 4 kinds con personalidad y velocidad.

## Decisiones

- **Sí:** personalidades clásicas del arcade (blinky/pinky/inky/clyde). Fieles al original y los 4 colores ya existían en `render.js`.
- **No:** set personalizado simple (agresivo + emboscador + cobarde + `'random'` actual). Menos fiel; se descarta.
- **Sí:** nombres de kind clásicos (`'blinky'`…). Mapean 1:1 con los colores arcade y son los reconocibles de la comunidad.
- **No:** nombres descriptivos (`'aggressive'`…). Inconsistente con la decisión anterior.
- **Sí:** los 4 nacen dentro del corral y salen libremente. Cero lógica nueva de salida.
- **No:** blinky naciendo fuera (estilo arcade) o salida escalonada por dots. Requieren lógica extra para poco juego en este proyecto.
- **Sí:** velocidades `1/9 · 1/10 · 1/11 · 1/12`. La lógica de alineación exige velocidades de forma `1/N` (con p. ej. 0.11 un fantasma nunca alinea y atraviesa paredes); escalón uniforme y todos más lentos que Pac-Man (1/8).
- **No:** velocidad única (0.1) o el agresivo por encima de 1/8 — elegiríamos menos diferenciación o un juego injusto.
- **Sí:** Pinky sin el overflow bug del arcade (arriba = 4 arriba + 4 izquierda). Más claro de depurar y verificar.
- **Sí:** Clyde usa distancia Manhattan (≤ 8). Consistente con el resto del código (el hunter ya usaba Manhattan); el arcade usa euclídea, se descarta por simplicidad.
- **Sí:** color ligado al kind en `render.js`. El color no depende del orden de `GHOST_STARTS`.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Dificultad salta de 2 a 4 fantasmas sin power pellets | Velocidades 1/9–1/12 mantienen a Pac-Man como el más rápido; vidas se quedan en 3. Ajuste fino en una spec futura si hace falta. |
| `inky` depende de que exista un fantasma `blinky` | Fallback documentado: si no lo encuentra, se comporta como `blinky` (no crash). |
| Fantasmas naciendo en columnas sin puerta (x=12, x=15) podrían tardar en salir | Los targets derivados de Pac-Man los guían hacia la puerta (cols 13-14); la regla del 180° en callejón evita quedarse clavados. |

## Qué **no** está en esta spec

- Modos scatter/chase con temporizadores (otra spec si algún día aterriza).
- Power pellets / modo frightened / comer fantasmas.
- Salida escalonada del corral.
- Cambios en vidas, score, laberinto o Pac-Man.
