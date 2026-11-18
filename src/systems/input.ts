/**
 * Keyboard state for the game loop. Uses `KeyboardEvent.code`, so WASD works
 * on QWERTZ and QWERTY alike. Discrete actions (jump, interact) are queued and
 * consumed once by the game loop.
 */
const pressed = new Set<string>();
let jumpQueued = false;

type Listener = (code: string) => void;
const actionListeners = new Set<Listener>();

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function isActivatable(target: EventTarget | null): boolean {
  return target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement;
}

function onKeyDown(e: KeyboardEvent) {
  if (isTyping(e.target)) return;
  // Space/Enter on a focused button must activate the button, not the game.
  if ((e.code === 'Space' || e.code === 'Enter') && isActivatable(e.target)) return;

  pressed.add(e.code);
  if (e.code === 'Space') {
    e.preventDefault(); // no page scroll
    if (!e.repeat) jumpQueued = true;
  }
  if (!e.repeat) actionListeners.forEach((fn) => fn(e.code));
}

function onKeyUp(e: KeyboardEvent) {
  pressed.delete(e.code);
}

function onBlur() {
  pressed.clear();
  jumpQueued = false;
}

export function isDown(...codes: string[]): boolean {
  return codes.some((c) => pressed.has(c));
}

export function consumeJump(): boolean {
  const j = jumpQueued;
  jumpQueued = false;
  return j;
}

/** Called once per key press (no auto-repeat) with the key code. */
export function onAction(fn: Listener): () => void {
  actionListeners.add(fn);
  return () => actionListeners.delete(fn);
}

export function initInput(): () => void {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    onBlur();
  };
}
