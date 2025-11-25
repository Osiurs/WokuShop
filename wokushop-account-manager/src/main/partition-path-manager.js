const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

class PartitionPathManager {
  constructor() {
    this.standardPartitionsPath = path.join(app.getPath('userData'), 'Partitions');
    try {
      if (!fs.existsSync(this.standardPartitionsPath)) {
        fs.mkdirSync(this.standardPartitionsPath, { recursive: true });
      }
    } catch (e) {
      const fallback = path.join(app.getPath('temp'), 'woku-partitions');
      if (!fs.existsSync(fallback)) {
        fs.mkdirSync(fallback, { recursive: true });
      }
      this.standardPartitionsPath = fallback;
    }
  }

  getLegacyRoots() {
    const roots = new Set();
    roots.add(path.join(os.homedir(), 'AppData', 'Roaming', 'wokushop-account-manager', 'Partitions'));
    const userData = app.getPath('userData');
    roots.add(path.join(userData, 'partitions'));
    roots.add(path.join(userData, 'sessions'));
    const appPath = app.getAppPath();
    roots.add(path.join(appPath, 'Partitions'));
    roots.add(path.join(appPath, 'partitions'));
    roots.delete(this.standardPartitionsPath);
    return Array.from(roots);
  }

  migrateAllPartitions() {
    let migrated = 0;
    const destRoot = this.standardPartitionsPath;
    for (const root of this.getLegacyRoots()) {
      try {
        if (!fs.existsSync(root)) continue;
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const dirent of entries) {
          if (!dirent.isDirectory()) continue;
          const name = dirent.name;
          const srcPath = path.join(root, name);
          const dstPath = path.join(destRoot, name);
          if (fs.existsSync(dstPath)) continue;
          try {
            fs.renameSync(srcPath, dstPath);
            migrated++;
          } catch (moveErr) {
            this.copyDirRecursive(srcPath, dstPath);
            migrated++;
          }
        }
      } catch (err) {}
    }
    return migrated;
  }

  copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirRecursive(s, d);
      } else if (entry.isSymbolicLink()) {
        try {
          const link = fs.readlinkSync(s);
          fs.symlinkSync(link, d);
        } catch (_) {}
      } else {
        fs.copyFileSync(s, d);
      }
    }
  }
}

module.exports = PartitionPathManager;
