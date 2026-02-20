import { useEffect } from 'react';
import axios from 'axios';

const KeepAlive = () => {
    useEffect(() => {
        const ping = () => {
            axios.get('/api/health')
                .then(() => console.log('[KeepAlive] Ping successful'))
                .catch(() => {});
        };
        ping();
        const interval = setInterval(ping, 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return null;
};

export default KeepAlive;
