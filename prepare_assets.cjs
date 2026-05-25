const fs = require('fs');
if (!fs.existsSync('assets')) {
  fs.mkdirSync('assets');
}

// Use the newly generated minimalist square logo for the app launcher icon
if (fs.existsSync('public/logo-pancho.png')) {
  fs.copyFileSync('public/logo-pancho.png', 'assets/icon.png');
} else if (fs.existsSync('public/favicon.png')) {
  fs.copyFileSync('public/favicon.png', 'assets/icon.png');
}

// Use the proper splash screen image for the splash asset
if (fs.existsSync('public/splash.png')) {
  fs.copyFileSync('public/splash.png', 'assets/splash.png');
} else if (fs.existsSync('public/logo-web.png')) {
  fs.copyFileSync('public/logo-web.png', 'assets/splash.png');
}

console.log('Assets prepared successfully.');

