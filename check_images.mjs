import fs from 'fs';
['public/logo.png', 'public/logo-1.png', 'src/assets/logo.png', 'assets/splash.png', 'public/android.png', 'assets/icon.png'].forEach(f => {
  try {
    console.log(f, fs.statSync(f).size);
  } catch(e) {
    console.log(f, 'missing');
  }
});
