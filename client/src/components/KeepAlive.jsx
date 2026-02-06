import { useEffect } from 'react';
import axios from 'axios';

const KeepAlive = () => {
    useEffect(() => {
        // Ping the server every 1 minute to prevent sleep
        const ping = () => {
            axios.get('/health')
                .then(() => console.log('[KeepAlive] Ping successful'))
                .catch(err => console.error('[KeepAlive] Ping failed', err));
        };
        ping(); // Immediate ping on mount
        const interval = setInterval(ping, 60 * 1000); // 1 minute
        return () => clearInterval(interval);
    }, []);

    return null; // This component renders nothing
};

export default KeepAlive;
