const fs = require('fs');
if (!fs.existsSync('assets')) {
  fs.mkdirSync('assets');
}
fs.copyFileSync('assets/splash.png', 'assets/icon.png');
fs.copyFileSync('assets/splash.png', 'assets/splash.png'); // This is redundant but keeps the structure
// Maybe copy to public too to be sure
fs.copyFileSync('assets/splash.png', 'public/logo.png');
fs.copyFileSync('assets/splash.png', 'public/android.png');
console.log('Assets prepared successfully.');
