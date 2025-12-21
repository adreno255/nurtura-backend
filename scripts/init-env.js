const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
const examplePath = path.resolve(process.cwd(), '.env.example');

if (fs.existsSync(envPath)) {
    console.log('✔ .env already exists. Skipping creation.');
    console.log('⚠ Please make sure that the values are up to date before starting the server.');
    process.exit(0);
}

if (!fs.existsSync(examplePath)) {
    console.error('✖ .env.example not found.');
    process.exit(1);
}

fs.copyFileSync(examplePath, envPath);
console.log('✔ .env created from .env.example');
console.log('⚠ Please update the values before starting the server.');
