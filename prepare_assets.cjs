const fs = require('fs');
if (!fs.existsSync('assets')) {
  fs.mkdirSync('assets');
}
fs.copyFileSync('public/logo-web.png', 'assets/icon.png');
fs.copyFileSync('public/logo-web.png', 'assets/splash.png');
console.log('Assets prepared successfully.');
