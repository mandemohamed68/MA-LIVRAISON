const fs = require('fs');

const files = [
  'src/components/NotificationToast.tsx',
  'src/components/Navbar.tsx',
  'src/components/NotificationBell.tsx',
  'src/components/AnnouncementBanner.tsx',
  'src/components/Chat.tsx',
  'src/lib/notificationService.ts',
  'src/views/DeliveryTracking.tsx',
  'src/views/CreateDelivery.tsx',
  'src/views/AdminDashboard.tsx',
  'src/views/ClientDashboard.tsx',
  'src/views/DeliveryHistory.tsx',
  'src/views/DriverDashboard.tsx',
  'src/context/AuthContext.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, 'utf8');
  
  const pathToFirebase = file.includes('src/lib/') ? './firebase' : '../lib/firebase';

  text = text.replace(/from\s+['"]firebase\/firestore['"]/g, `from '${pathToFirebase}'`);
  text = text.replace(/from\s+['"]firebase\/auth['"]/g, `from '${pathToFirebase}'`);
  text = text.replace(/from\s+['"]firebase\/app['"]/g, `from '${pathToFirebase}'`);

  fs.writeFileSync(file, text);
  console.log('Updated ' + file);
});
