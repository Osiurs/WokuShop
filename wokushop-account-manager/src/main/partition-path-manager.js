const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

/**
 * PartitionPathManager
 * - Centralizes where we store persistent Electron session partitions
 * - Provides a migration helper from legacy locations to the standard path
 */
class PartitionPathManager {
  constructor() {
    // Standard location inside userData
    this.standardPartitionsPath = path.join(app.getPath('userData'), 'Partitions');

    // Ensure the standard directory exists
    try {
      if (!fs.existsSync(this.standardPartitionsPath)) {
        fs.mkdirSync(this.standardPartitionsPath, { recursive: true });
      }
    } catch (e) {
      // Last-resort fallback inside temp if userData is not available
      const fallback = path.join(app.getPath('temp'), 'woku-partitions');
      if (!fs.existsSync(fallback)) {
        fs.mkdirSync(fallback, { recursive: true });
      }
      this.standardPartitionsPath = fallback;
    }
  }

  /**
   * Return an array of potential legacy partition roots to migrate from
   */
  getLegacyRoots() {
    const roots = new Set();

    // 1) Older expected appData path with different casing
    roots.add(path.join(os.homedir(), 'AppData', 'Roaming', 'wokushop-account-manager', 'Partitions'));

    // 2) Potential variations inside userData
    const userData = app.getPath('userData');
    roots.add(path.join(userData, 'partitions'));
    roots.add(path.join(userData, 'sessions'));

    // 3) Misc legacy relative folders (very defensive)
    const appPath = app.getAppPath();
    roots.add(path.join(appPath, 'Partitions'));
    roots.add(path.join(appPath, 'partitions'));

    // Remove the standard path itself
    roots.delete(this.standardPartitionsPath);

    return Array.from(roots);
  }

  /**
   * Migrate all folders from legacy roots to the standard path.
   * Returns the number of partition directories moved/copied.
   */
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
          // Partition folders are typically the partition id (persist:<id> is not used on disk)
          const srcPath = path.join(root, name);
          const dstPath = path.join(destRoot, name);
          if (fs.existsSync(dstPath)) continue; // already migrated

          try {
            // Try move first (fast)
            fs.renameSync(srcPath, dstPath);
            migrated++;
          } catch (moveErr) {
            // Fallback to copy
            this.copyDirRecursive(srcPath, dstPath);
            migrated++;
          }
        }
      } catch (err) {
        // Ignore errors from unreadable roots
      }
    }

    return migrated;
  }

  /**
   * Utility: copy directory recursively
   */
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

