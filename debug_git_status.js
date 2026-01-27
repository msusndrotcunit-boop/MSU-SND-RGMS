const { exec } = require('child_process');
const fs = require('fs');

const git = '"C:\\Program Files\\Git\\cmd\\git.exe"';

exec(`${git} status`, (err, stdout, stderr) => {
    let log = "--- STATUS ---\n";
    log += stdout || stderr;
    log += "\n--- LOG ---\n";
    
    exec(`${git} log -n 3`, (err2, stdout2, stderr2) => {
        log += stdout2 || stderr2;
        fs.writeFileSync('git_status_check.txt', log);
    });
});
