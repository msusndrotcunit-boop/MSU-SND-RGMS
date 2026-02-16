const SSE_CLIENTS = [];
function broadcastEvent(evt) {
  const line = `data: ${JSON.stringify(evt)}\n\n`;
  for (const res of SSE_CLIENTS) {
    try {
      if (!res.writableEnded) res.write(line);
    } catch (_) {}
  }
}
module.exports = { broadcastEvent, SSE_CLIENTS };
