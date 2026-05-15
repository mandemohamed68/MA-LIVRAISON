const fs = require('fs');
if (!fs.existsSync('assets')) {
  fs.mkdirSync('assets');
}
fs.copyFileSync('public/android.png', 'assets/icon.png');
fs.copyFileSync('public/android.png', 'assets/splash.png');
console.log('Assets prepared successfully.');
