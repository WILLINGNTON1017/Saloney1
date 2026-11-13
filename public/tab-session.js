// Solo se comparten avisos; las credenciales permanecen en la cookie HttpOnly.
const key = 'saloney-session-change';
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(key) : null;
let reloading = false;
function reloadSession() {
  if (reloading) return;
  reloading = true;
  location.reload();
}
if (channel) channel.onmessage = reloadSession;
window.addEventListener('storage', event => {
  if (event.key === key) reloadSession();
});
export function announceSessionChange() {
  channel?.postMessage('changed');
  try { localStorage.setItem(key, `${Date.now()}-${Math.random()}`); } catch {}
}
