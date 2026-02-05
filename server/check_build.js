const fs = require('fs');
const path = require('path');

console.log('CWD:', process.cwd());
console.log('__dirname:', __dirname);

const possibleBuildPaths = [
    path.join(__dirname, '../client/dist'),
    path.join(__dirname, 'client/dist'),
    path.join(process.cwd(), 'client/dist'),
    path.join(process.cwd(), '../client/dist')
];

console.log('\nChecking possible build paths:');
possibleBuildPaths.forEach(p => {
    const exists = fs.existsSync(p);
    const hasIndex = exists && fs.existsSync(path.join(p, 'index.html'));
    console.log(`Path: ${p}`);
    console.log(`  Exists: ${exists}`);
    console.log(`  Has index.html: ${hasIndex}`);
    if (exists) {
        try {
            const files = fs.readdirSync(p);
            console.log(`  Files (${files.length}):`, files.slice(0, 5));
        } catch (e) {
            console.log(`  Error listing files: ${e.message}`);
        }
    }
});
