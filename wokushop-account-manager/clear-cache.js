const fs = require('fs');
const path = require('path');
const os = require('os');

const pathsToDelete = [
  // Electron-builder cache
  path.join(os.homedir(), 'Library', 'Caches', 'electron-builder'), // macOS
  path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'cache'), // Windows
  path.join(os.homedir(), '.cache', 'electron-builder'), // Linux

  // npm cache
  path.join(os.homedir(), '.npm'),

  // App data
  path.join(os.homedir(), 'AppData', 'Roaming', 'WokuShop App'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'woku-app'),

  // Project specific
  'node_modules',
  'dist',
  'package-lock.json'
];

console.log('--- Clearing Caches and Build Artifacts ---');

pathsToDelete.forEach(p => {
  if (fs.existsSync(p)) {
    try {
      fs.rmSync(p, { recursive: true, force: true });
      console.log(`✅ Removed: ${p}`);
    } catch (e) {
      console.error(`❌ Failed to remove ${p}: ${e.message}`);
    }
  } else {
    console.log(`- Skipping (not found): ${p}`);
  }
});

console.log('\n--- Cache cleared successfully! ---');
console.log('You can now run "npm install" and "npm start".');

