# SPEC 02 — Power pellets y fantasmas comestibles

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-07
> **Objetivo:** Cuatro power pellets en las esquinas asustan a los fantasmas durante 6 s, volviéndolos comestibles por 200/400/800/1600 puntos mientras sus ojos regresan al corral para revivir.

## Por qué existe esta spec

SPEC 01 la dejó fuera explícitamente y el juego con 4 cazadores la necesita: sin pellets, Pac-Man no tiene herramienta de desquite. El timestep fijo a 60 ticks/s (commit `915dd34`) permite temporizadores exactos en ticks: 360 = 6 s reales en cualquier monitor.

## Scope

**In:**

- `maze.js`: nuevo char `o` → valor `4` en `parseTile`, sustituyendo el `.` de las 4 esquinas clásicas (1,3), (26,3), (1,23), (26,23).
- `game.js`: comer pellet = +50 pts, activa `frightenedTicks = 360`, reinicia la cadena y gira 180° a todos los fantasmas no-ojos. Mientras `frightenedTicks > 0`: fantasmas no-ojos huyen (target espejo de Pac-Man, reutilizando el selector voraz) a velocidad `1/(2N)`. Fantasma asustado comido → cadena 200/400/800/1600, se vuelve **ojos** a velocidad `1/6` que navegan al corral por campo BFS y reviven al entrar (`enCorral`). Colisiones diferenciadas: normal → vida menos; asustado → comido; ojos → se atraviesan. Perder una vida corta el modo.
- `render.js`: pellets grandes parpadeantes; fantasma asustado azul; blanco/azul alternado los últimos 120 ticks; ojos = solo los ojos, sin cuerpo.
- `AGENTS.md`: documentar tile `4`, modo frightened, ojos y puntuación.

**Out of scope (para futuras specs):**

- Fruta / bonus, niveles, tabla de duración por nivel.
- Números flotantes ("200") al comer un fantasma.
- Que los pellets cuenten para ganar (decisión explícita: **no** restan a `dotsRemaining`).
- Puerta unidireccional (ya descartada en SPEC 01), scatter/chase, pausa, high scores.

## Data model

```js
// maze.js — parseTile
if ( ch === 'o' ) return 4; // power pellet

// game.js
const FRIGHTENED_TICKS = 360;  // 6 s a 60 ticks/s
const WARNING_TICKS = 120;     // ultimos 2 s: parpadeo blanco/azul
const FRIGHTENED_SPEEDS = { blinky: 1 / 18, pinky: 1 / 20, inky: 1 / 22, clyde: 1 / 24 };
const EYES_SPEED = 1 / 6;      // mas rapido que Pac-Man (1/8)
const GHOST_EAT_POINTS = [ 200, 400, 800, 1600 ];
const PELLET_POINTS = 50;

// estado en createGame()
frightenedTicks: 0,   // ticks restantes del modo
ghostEatChain: 0,     // indice en GHOST_EAT_POINTS; resetea al comer pellet o al acabar el modo
// por fantasma: g.state: 'normal' | 'eyes'   ·   penDist: campo BFS hasta (13,14)

// render.js
PELLET_COLOR = DOT_COLOR (radio ~6 vs 2.5) · FRIGHTENED_COLOR = '#2121ff' · flash blanco
```

Convenciones heredadas: velocidades siempre `1/N` (exigencia de `aligned()` con ε=1e-3); temporización en ticks (60/s exactos gracias al timestep fijo). Nota: `createGame()` cuenta `dotsRemaining` con `v === 2`, así que los pellets (`4`) ya quedan fuera de la victoria sin código extra.

## Plan de implementación

1. `maze.js` + `render.js`: char `o`→4 en las 4 esquinas; render dibuja `v===4` como pellet grande parpadeante. Manual: se ven 4 pellets gordos parpadeando (aún sin efecto).
2. `game.js` + `render.js`: modo frightened de vivos completo — comer pellet (+50, reversa 180°, timer 360), huida por target espejo a `1/(2N)`, azul con parpadeo blanco los últimos 120 ticks. Manual: giran, huyen lentos, parpadean al final, vuelven a la normalidad a los 6 s.
3. `game.js` + `render.js`: comer fantasmas (cadena 200/400/800/1600), ojos con BFS al corral y revivir al entrar, colisiones diferenciadas, perder vida corta el modo. Manual: comer 2 seguidos suma 200 y 400; los ojos cruzan hasta el corral, entran y reviven; tocar un fantasma normal quita vida igual que antes.
4. `AGENTS.md`: documentar tile `4`, modo frightened, ojos y puntos.

## Criterios de aceptación

- [ ] Se ven 4 pellets grandes parpadeantes en (1,3), (26,3), (1,23), (26,23); comer uno da exactamente +50.
- [ ] Al comerlo, los fantasmas no-ojos giran 180°, se ponen azules y huyen de Pac-Man a 1/18…1/24.
- [ ] El modo dura 6 s exactos; los últimos 2 s alternan blanco/azul.
- [ ] Comer fantasmas asustados suma 200/400/800/1600; la cadena se reinicia con cada pellet nuevo.
- [ ] El fantasma comido se vuelve ojos (sin cuerpo) a 1/6, llega al corral desde cualquier celda sin atascarse ni atravesar paredes, entra por la puerta y revive; como ojos, Pac-Man lo atraviesa sin efecto.
- [ ] Los pellets no restan a `dotsRemaining`: se gana comiendo solo los dots normales.
- [ ] Perder una vida corta el frightened y resetea la cadena; el resto del comportamiento de vidas/`'lost'`/`'won'` queda intacto.
- [ ] Sin errores en consola durante una partida completa usando pellets.
- [ ] `AGENTS.md` documenta tile `4`, modo frightened, ojos y puntuación.

## Decisiones

- **Sí:** `o`→4 en `MAZE_STR` (esquinas clásicas) — consistente con la filosofía de `maze.js`. **No:** lista de coordenadas en `game.js` (duplica la fuente de verdad).
- **Sí:** huida con target espejo (`2·g − pac`) reutilizando el selector voraz actual — cero selector nuevo y fácil de verificar. **No:** dirección aleatoria clásica — el usuario eligió huida.
- **Sí:** ojos navegan por campo BFS precomputado hasta (13,14) y reviven con `enCorral` — el greedy puede orbitar en bucle (lección de la trampa del corral de SPEC 01); BFS garantiza llegada. **No:** ojos con greedy.
- **Sí:** asustados `1/(2N)`, ojos `1/6` — todos forma `1/N`.
- **Sí:** parpadeo de aviso, reversa 180° general, cadena clásica, huir también dentro del corral y pellets fuera de la victoria — decisiones del usuario en la fase de preguntas.
- **Sí:** un único timer global — un fantasma que revive con el modo aún activo vuelve a estar asustado (simplicidad). **No:** frightened por fantasma.
- **Sí:** perder vida corta el modo y resetea la cadena — evita estados zombis tras el reset de posiciones.
- **Sí (fix al implementar el paso 3):** `snapToCell()` — alinear a la celda más cercana en las transiciones de velocidad a mitad de segmento: comer fantasma (`1/(2N)`→`1/6`) y expiración del modo (`1/(2N)`→`1/N`). Sin él, el fantasma queda en un múltiplo no entero de la nueva velocidad, `aligned()` nunca vuelve a disparar, `decideGhost`/`canMove` no se evalúan y cruza paredes en línea recta fuera de pantalla (bug visto en juego real: los ojos se iban de la pantalla y no regresaban). Comer pellet (`1/N`→`1/(2N)`, siempre alcanza un entero) y revivir (ocurre ya alineado) son matemáticamente seguros y no llevan snap.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Un fantasma asustado puede refugiarse en el corral (puerta bidireccional, Pac-Man no puede entrar) | Aceptado ≤6 s; al acabar el modo, `PEN_EXIT` lo saca (verificado en SPEC 01). Si molesta: futura spec de puerta unidireccional |
| Huida greedy dentro del corral puede orbitar con Pac-Man arriba | El modo expira solo a los 360 ticks; después `PEN_EXIT` saca a todos |
| Parpadeo/tiempos dependientes del refresco | Timestep fijo a 60 ticks/s: contadores exactos en cualquier monitor |

## Qué **no** está en esta spec

Fruta · niveles · scatter/chase · números flotantes · high scores · puerta unidireccional · pausa.
