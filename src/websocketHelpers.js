export function sendLineState(state, text) {
  if (!state || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  state.ws.send(JSON.stringify({ type: 'input', data: text + '\r\n' }));
}

export function sendRawLine(ws, text) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'input', data: text + '\r\n' }));
  setTimeout(() => {
    ws.send(JSON.stringify({ type: 'input', data: '\r\n' }));
  }, 300);
}
