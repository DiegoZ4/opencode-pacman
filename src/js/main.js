// main.js
// Bucle, teclado y pantallas. Usa createGame/update/draw (globals).

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );
const overlay = document.getElementById( 'overlay' );
const actionBtn = document.getElementById( 'action-btn' );

let game = createGame();
let frame = 0;

const KEY_DIR = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

document.addEventListener( 'keydown', ( e ) => {
  const dir = KEY_DIR[ e.key ];
  if ( !dir ) return;
  e.preventDefault();
  if ( game.state === 'playing' ) game.pacman.nextDir = dir;
} );

function showOverlay( title, cls, btnLabel ) {
  overlay.innerHTML =
    '<h1' + ( cls ? ' class="' + cls + '"' : '' ) + '>' + title + '</h1>' +
    '<button id="action-btn">' + btnLabel + '</button>';
  overlay.classList.add( 'show' );
  document.getElementById( 'action-btn' ).addEventListener( 'click', startGame );
}

function startGame() {
  game = createGame();
  game.state = 'playing';
  overlay.classList.remove( 'show' );
}

if ( actionBtn ) actionBtn.addEventListener( 'click', startGame );

// Bucle con timestep fijo: la logica avanza a 60 ticks/s en cualquier monitor.
// requestAnimationFrame dispara al refresco de pantalla, asi que sin acumulador
// la velocidad del juego dependeria del monitor (a 120 Hz iria al doble).
const TICK_MS = 1000 / 60;
let lastTime = 0;
let acc = 0;

function loop( now ) {
  if ( !lastTime ) lastTime = now;
  // Cap del delta: al volver de una pestana en segundo plano, no intentar
  // recuperar de golpe el tiempo perdido (la partida saltaria).
  acc += Math.min( now - lastTime, 100 );
  lastTime = now;

  while ( acc >= TICK_MS ) {
    acc -= TICK_MS;
    frame++;
    if ( game.state === 'playing' ) {
      update( game );
      if ( game.state === 'won' ) showOverlay( 'GANASTE', 'win', 'Reiniciar' );
      else if ( game.state === 'lost' ) showOverlay( 'PERDISTE', 'lose', 'Reiniciar' );
    }
  }

  draw( ctx, game, frame );
  requestAnimationFrame( loop );
}

requestAnimationFrame( loop );
