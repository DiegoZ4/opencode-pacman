// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
// Velocidad por personalidad (celda/frame). Siempre de la forma 1/N para que
// aligned() con eps=1e-3 alinee exactamente. blinky el mas rapido, clyde el mas lento.
const GHOST_SPEEDS = { blinky: 1 / 9, pinky: 1 / 10, inky: 1 / 11, clyde: 1 / 12 };

// SPEC 02 — power pellets y modo frightened.
const FRIGHTENED_TICKS = 360; // 6 s a 60 ticks/s (timestep fijo de main.js)
const WARNING_TICKS = 120;    // ultimos 2 s: parpadeo blanco/azul en render.js
const FRIGHTENED_SPEEDS = { blinky: 1 / 18, pinky: 1 / 20, inky: 1 / 22, clyde: 1 / 24 };
const EYES_SPEED = 1 / 6;     // ojos comidos: mas rapidos que Pac-Man (1/8)
const PELLET_POINTS = 50;

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    frightenedTicks: 0, // SPEC 02: ticks restantes del modo asustado
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      kind: g.kind,
      state: 'normal', // 'normal' | 'eyes' — la velocidad se deriva del modo
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Comer power pellet (SPEC 02): asusta a los fantasmas.
    // No resta dotsRemaining: los pellets no cuentan para ganar.
    else if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += PELLET_POINTS;
      game.frightenedTicks = FRIGHTENED_TICKS;
      for ( const g of game.ghosts ) {
        if ( g.state === 'eyes' ) continue;
        g.dir = OPPOSITE[ g.dir ];
        // El giro no debe ser pisado por decideGhost en la proxima celda.
        g.reversePending = true;
      }
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Celda sobre la puerta: salida fija del corral.
const PEN_EXIT = { x: 13, y: 11 };

// Esquina de retiro de clyde (inferior izquierda, transitable).
const CLYDE_CORNER = { x: 1, y: 29 };

// Celda objetivo de cada personalidad. Puede caer fuera del laberinto:
// el selector voraz solo compara distancias Manhattan.
function ghostTarget( game, g ) {
  const p = game.pacman;
  const pac = { x: Math.round( p.x ), y: Math.round( p.y ) };
  const d = DIRS[ p.dir ] || DIRS.left;

  // SPEC 02: frightened -> huir de Pac-Man (target espejo: 2*g - pac).
  // Tambien dentro del corral (decision de la spec): la guarda no aplica.
  if ( game.frightenedTicks > 0 && g.state !== 'eyes' ) {
    return { x: 2 * g.x - pac.x, y: 2 * g.y - pac.y };
  }

  // Guarda de salida del corral: dentro (o sobre la puerta) el target es
  // fijo, porque con el target debajo del corral el selector voraz nunca
  // eligiria subir por la puerta (unica salida) y quedaria encerrado.
  const enCorral = ( g.x >= 11 && g.x <= 16 && g.y >= 13 && g.y <= 15 ) ||
    ( g.y === 12 && ( g.x === 13 || g.x === 14 ) );
  if ( enCorral ) return PEN_EXIT;

  if ( g.kind === 'blinky' ) return pac;
  if ( g.kind === 'pinky' ) return { x: pac.x + 4 * d.x, y: pac.y + 4 * d.y };
  if ( g.kind === 'inky' ) {
    const blinky = game.ghosts.find( ( o ) => o.kind === 'blinky' );
    if ( !blinky ) return pac; // fallback: sin blinky, actua como blinky
    const b = { x: Math.round( blinky.x ), y: Math.round( blinky.y ) };
    const ahead = { x: pac.x + 2 * d.x, y: pac.y + 2 * d.y };
    // Flanqueo: target = blinky + 2 * (ahead - blinky).
    return { x: b.x + 2 * ( ahead.x - b.x ), y: b.y + 2 * ( ahead.y - b.y ) };
  }
  if ( g.kind === 'clyde' ) {
    const dist = Math.abs( g.x - pac.x ) + Math.abs( g.y - pac.y );
    return dist > 8 ? pac : CLYDE_CORNER;
  }
  return pac; // kind desconocido: perseguir como blinky
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const target = ghostTarget( game, g );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Selector voraz comun: direccion valida sin reversa que minimice la
  // distancia Manhattan al target.
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Velocidad efectiva segun modo: ojos > frightened > normal.
// Se calcula al vuelo para que expirar o cortar el modo no requiera
// restaurar velocidades a mano (unica fuente de verdad: el estado).
function ghostSpeed( game, g ) {
  if ( g.state === 'eyes' ) return EYES_SPEED;
  if ( game.frightenedTicks > 0 ) return FRIGHTENED_SPEEDS[ g.kind ] || GHOST_SPEEDS[ g.kind ];
  return GHOST_SPEEDS[ g.kind ];
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    // Giro 180 forzado (power pellet): decideGhost no lo pisa en esta celda.
    if ( g.reversePending ) g.reversePending = false;
    else decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  const speed = ghostSpeed( game, g );
  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.reversePending = false;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      game.frightenedTicks = 0; // SPEC 02: perder una vida corta el modo
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.frightenedTicks > 0 ) game.frightenedTicks--;
  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.WARNING_TICKS = WARNING_TICKS; // render.js lo usa para el parpadeo final
