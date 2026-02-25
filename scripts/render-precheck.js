#!/usr/bin/env node
/**
 * Render Deployment Diagnostic Script
 * Checks for common 502 issues before deployment
 */

const fs = require('fs');
const path = require('path');

// Go up to project root
const projectRoot = path.join(__dirname, '..');

const checks = {
  nodeVersion: () => {
    const version = process.version;
    console.log(`✓ Node.js version: ${version}`);
    const major = parseInt(version.split('.')[0].substring(1));
    if (major >= 18) {
      console.log('  → Meets requirement (>=18)');
      return true;
    }
    console.warn('  → WARNING: Requires Node.js >=18');
    return false;
  },

  serverFileExists: () => {
    const file = path.join(projectRoot, 'server', 'server.js');
    if (fs.existsSync(file)) {
      console.log(`✓ Server file exists: ${path.relative(projectRoot, file)}`);
      return true;
    }
    console.error(`✗ Server file NOT found: ${file}`);
    return false;
  },

  clientBuildExists: () => {
    const indexHtml = path.join(projectRoot, 'client', 'dist', 'index.html');
    
    if (fs.existsSync(indexHtml)) {
      console.log(`✓ Client build exists: ${path.relative(projectRoot, indexHtml)}`);
      return true;
    }
    console.warn(`⚠ Client build NOT found at ${path.relative(projectRoot, path.join(projectRoot, 'client', 'dist'))}`);
    console.warn('  → Run: npm run build');
    return false;
  },

  packageJsonScripts: () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    const scripts = pkg.scripts || {};
    
    const required = ['build', 'start'];
    let ok = true;
    
    for (const script of required) {
      if (scripts[script]) {
        console.log(`✓ Script exists: npm ${script}`);
        console.log(`  → ${scripts[script]}`);
      } else {
        console.error(`✗ Script missing: npm ${script}`);
        ok = false;
      }
    }
    return ok;
  },

  renderYamlExists: () => {
    const file = path.join(projectRoot, 'render.yaml');
    if (fs.existsSync(file)) {
      console.log(`✓ Render config exists: ${path.relative(projectRoot, file)}`);
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('autoDeploy: true')) {
        console.log('  → autoDeploy is enabled');
      }
      return true;
    }
    console.error(`✗ Render config NOT found: ${file}`);
    return false;
  },

  databaseFileExists: () => {
    const file = path.join(projectRoot, 'server', 'database.js');
    if (fs.existsSync(file)) {
      console.log(`✓ Database module exists: ${path.relative(projectRoot, file)}`);
      return true;
    }
    console.error(`✗ Database module NOT found: ${file}`);
    return false;
  },

  gitConfigured: () => {
    const gitDir = path.join(projectRoot, '.git');
    if (fs.existsSync(gitDir)) {
      console.log(`✓ Git repository configured`);
      return true;
    }
    console.warn(`⚠ Git repository NOT initialized`);
    console.warn('  → Run: git init && git remote add origin <url>');
    return false;
  }
};

// Run all checks
console.log('\n=== Render Deployment Pre-Check ===\n');

let allPassed = true;
for (const [name, check] of Object.entries(checks)) {
  try {
    const passed = check();
    if (!passed) allPassed = false;
  } catch (err) {
    console.error(`✗ Check failed: ${name}`);
    console.error(`  Error: ${err.message}`);
    allPassed = false;
  }
  console.log();
}

if (allPassed) {
  console.log('✓ All checks PASSED! Ready to deploy to Render.');
  process.exit(0);
} else {
  console.log('⚠ Some checks failed. Please review above and fix issues before deploying.');
  process.exit(1);
}
