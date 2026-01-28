const db = require('../server/database');
const axios = require('../server/node_modules/axios');
const xlsx = require('../server/node_modules/xlsx');
const { processCadetData } = require('../server/utils/importCadets');

const url = 'https://1drv.ms/x/c/bb76b11040c80712/IQA3-TdlvbQOQoWC0-uPfPu3Aa0AjQbf1cq-ET8mDByhbYY';

function toBase64Url(str) {
    return Buffer.from(str).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function runSync() {
    console.log('Starting manual sync...');
    console.log('Target URL:', url);
    
    try {
        // 1. Resolve the short URL to the full OneDrive URL
        console.log('Resolving short URL...');
        let resolvedUrl = url;
        try {
            const resp = await axios.get(url, {
                maxRedirects: 0,
                validateStatus: status => status >= 300 && status < 400
            });
            if (resp.headers.location) {
                resolvedUrl = resp.headers.location;
                console.log('Resolved URL:', resolvedUrl);
            }
        } catch (e) {
            // If it doesn't redirect (maybe it's already full or 200), use original
            console.log('No redirect or error resolving:', e.message);
        }

        // 2. Prepare Candidate URLs
        const candidates = [];
        
        try {
            const u = new URL(resolvedUrl);
            const pathParts = u.pathname.split('/');
            
            let cid = null;
            let authkey = null;
            let resid = u.searchParams.get('resid');
            
            // Extract Authkey from path
            const personalIndex = pathParts.findIndex(p => p.toLowerCase() === 'personal');
            if (personalIndex !== -1 && pathParts.length > personalIndex + 2) {
                cid = pathParts[personalIndex + 1];
                authkey = pathParts[personalIndex + 2];
            }
            
            if (!cid && resid) {
                cid = resid.split('!')[0];
            }

            if (resid && authkey) {
                // 1. Embed Download (often most reliable for public links)
                candidates.push(`https://onedrive.live.com/embed?cid=${cid}&resid=${resid}&authkey=${authkey}&em=2`);
                
                // 2. Export
                candidates.push(`https://onedrive.live.com/export?cid=${cid}&resid=${resid}&authkey=${authkey}&format=xlsx`);
                
                // 3. Direct Download (Legacy)
                candidates.push({ url: `https://onedrive.live.com/download?cid=${cid}&resid=${resid}&authkey=${authkey}`, ua: 'Mozilla/5.0' });
                // Try without UA (sometimes avoids HTML redirect)
                candidates.push({ url: `https://onedrive.live.com/download?cid=${cid}&resid=${resid}&authkey=${authkey}`, ua: null });
                
                // 4. ASPX Download
                candidates.push({ url: `https://onedrive.live.com/download.aspx?cid=${cid}&resid=${resid}&authkey=${authkey}`, ua: 'Mozilla/5.0' });
            }
        } catch (e) {
            console.log('Error parsing URL for candidates:', e.message);
        }

        // 5. Fallback: Resolved URL with download=1
        let fallbackUrl = resolvedUrl;
        if (!fallbackUrl.includes('download=1')) {
             fallbackUrl += (fallbackUrl.includes('?') ? '&' : '?') + 'download=1';
        }
        candidates.push({ url: fallbackUrl, ua: 'Mozilla/5.0' });

        let response = null;
        let successUrl = null;

        for (const candidate of candidates) {
            const targetUrl = typeof candidate === 'string' ? candidate : candidate.url;
            const ua = typeof candidate === 'object' ? candidate.ua : 'Mozilla/5.0';
            
            console.log('Trying URL:', targetUrl, ua ? `(UA: ${ua})` : '(No UA)');
            
            try {
                const headers = {};
                if (ua) headers['User-Agent'] = ua;
                
                const resp = await axios.get(targetUrl, {
                    responseType: 'arraybuffer',
                    headers: headers,
                    validateStatus: (status) => status < 400
                });
                
                // Check if HTML
                const header = resp.data.slice(0, 20).toString('utf8');
                if (header.includes('<!DOCTYPE') || header.includes('<html') || header.startsWith('<!--')) {
                    console.log('-> Failed: Returned HTML');
                    continue;
                }
                
                response = resp;
                successUrl = targetUrl;
                console.log('-> Success!');
                break;
            } catch (e) {
                console.log('-> Failed:', e.message);
                if (e.response && e.response.status === 401) console.log('   (401 Unauthorized)');
                if (e.response && e.response.status === 403) console.log('   (403 Forbidden)');
            }
        }

        if (!response) {
            console.error('All download attempts failed. Saving URL to settings anyway for future retries.');
            // Save the URL anyway
             db.run("UPDATE system_settings SET value = ? WHERE key = 'cadet_list_source_url'", [url], function(err) {
                if (err && err.message.includes('no such table')) { 
                     // ignore 
                }
                if (this.changes === 0) {
                    db.run("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('cadet_list_source_url', ?)", [url]);
                }
                console.log('URL saved to settings (even though sync failed).');
            });
            return;
        }

        console.log('Download Success! Size:', response.data.length);

        // Process data
        const workbook = xlsx.read(response.data, { type: 'buffer' });
        let data = [];
        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            data = data.concat(xlsx.utils.sheet_to_json(sheet));
        });
        
        const result = await processCadetData(data);
        console.log(`Import result: Success=${result.successCount}, Failed=${result.failCount}`);

        // Save URL if successful
        if (result.successCount > 0) {
            // Save the ORIGINAL short URL, as it's cleaner and likely permanent
            db.run("UPDATE system_settings SET value = ? WHERE key = 'cadet_list_source_url'", [url], function(err) {
                if (err && err.message.includes('no such table')) { 
                     // ignore 
                }
                if (this.changes === 0) {
                    db.run("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('cadet_list_source_url', ?)", [url]);
                }
                console.log('URL saved to settings.');
            });
        }

    } catch (err) {
        console.error('Sync failed:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            try {
                 console.error('Data:', err.response.data.toString());
            } catch (e) {}
        }
    }
}

runSync();
