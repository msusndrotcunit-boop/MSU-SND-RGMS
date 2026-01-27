const { exec } = require('child_process');
const fs = require('fs');

const git = '"C:\\Program Files\\Git\\cmd\\git.exe"';

const commands = [
    `${git} remote -v`,
    `${git} branch --show-current`,
    `${git} log -n 5 --pretty=format:"%h - %s (%cr)"`,
    `${git} status`
];

async function runCommands() {
    let output = "--- GIT DIAGNOSTICS ---\n";
    
    for (const cmd of commands) {
        output += `\n> ${cmd}\n`;
        try {
            const result = await new Promise((resolve) => {
                exec(cmd, (error, stdout, stderr) => {
                    resolve(stdout || stderr);
                });
            });
            output += result;
        } catch (e) {
            output += `Error: ${e.message}`;
        }
    }
    
    fs.writeFileSync('git_diag.txt', output);
    console.log('Diagnostics written to git_diag.txt');
}

runCommands();
