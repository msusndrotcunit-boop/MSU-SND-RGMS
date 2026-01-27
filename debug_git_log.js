const { exec } = require('child_process');
const fs = require('fs');

const git = '"C:\\Program Files\\Git\\cmd\\git.exe"';

exec(`${git} log -n 10 --pretty=format:"%h - %s"`, (err, stdout, stderr) => {
    let log = "--- GIT LOG ---\n";
    log += stdout || stderr;
    fs.writeFileSync('git_log_debug.txt', log);
    console.log("Log written to git_log_debug.txt");
});
