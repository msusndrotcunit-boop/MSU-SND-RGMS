const db = require('../server/database');
const { processUrlImport } = require('../server/utils/importCadets');

const url = 'https://1drv.ms/x/c/bb76b11040c80712/IQA3-TdlvbQOQoWC0-uPfPu3Aa0AjQbf1cq-ET8mDByhbYY';

async function runSync() {
    console.log('Starting manual sync using server logic...');
    console.log('Target URL:', url);
    
    try {
        const result = await processUrlImport(url);
        console.log(`Import result: Success=${result.successCount}, Failed=${result.failCount}`);
        if (result.errors && result.errors.length > 0) {
            console.log('Errors:', result.errors);
        }

        // Save URL if successful
        if (result.successCount > 0) {
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
        
        // Even if it failed, save the URL so the server can retry later automatically
        db.run("UPDATE system_settings SET value = ? WHERE key = 'cadet_list_source_url'", [url], function(err) {
            if (this.changes === 0) {
                db.run("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('cadet_list_source_url', ?)", [url]);
            }
            console.log('URL saved to settings (for future retries).');
        });
    }
}

runSync();
