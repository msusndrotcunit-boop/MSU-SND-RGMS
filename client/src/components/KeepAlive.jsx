import { useEffect } from 'react';
import axios from 'axios';

const KeepAlive = () => {
    useEffect(() => {
        // Ping the server every 5 minutes to prevent sleep
        const interval = setInterval(() => {
            axios.get('/health')
                .then(() => console.log('[KeepAlive] Ping successful'))
                .catch(err => console.error('[KeepAlive] Ping failed', err));
        }, 5 * 60 * 1000); // 5 minutes

        return () => clearInterval(interval);
    }, []);

    return null; // This component renders nothing
};

export default KeepAlive;
