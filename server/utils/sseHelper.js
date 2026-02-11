// Simple SSE clients registry (shared via global)
const SSE_CLIENTS = global.__sseClients || [];
global.__sseClients = SSE_CLIENTS;

function broadcastEvent(event) {
    try {
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        SSE_CLIENTS.forEach((res) => {
            try { 
                // Check if response is still open
                if (!res.writableEnded) {
                    res.write(payload); 
                }
            } catch (e) { 
                /* ignore */ 
            }
        });
    } catch (e) {
        console.error('SSE broadcast error', e);
    }
}

module.exports = {
    SSE_CLIENTS,
    broadcastEvent
};
