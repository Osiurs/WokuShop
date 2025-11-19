/**
 * Auto Deployment Manager for Electron App
 * Tích hợp deployment trực tiếp vào ứng dụng
 *
 * @author Claude Code
 * @date 2025-01-06
 */

const { Client } = require('ssh2');
const fs = require('fs').promises;
const path = require('path');
const { dialog } = require('electron');

class AutoDeploymentManager {
    constructor() {
        this.ssh = new Client();
        this.deploymentInProgress = false;
        this.deploymentLog = [];
        this.config = this.loadSavedConfig();
    }

    loadSavedConfig() {
        // Load saved SSH config từ electron-store
        const Store = require('electron-store');
        const store = new Store();

        return store.get('sshDeploymentConfig', {
            host: '',
            username: '',
            port: 22,
            remotePath: '/var/www/html/wokushop-api',
            dbName: '',
            dbUser: ''
        });
    }

    saveConfig(config) {
        const Store = require('electron-store');
        const store = new Store();

        // Don't save password for security
        const configToSave = { ...config };
        delete configToSave.password;
        delete configToSave.dbPassword;

        store.set('sshDeploymentConfig', configToSave);
        this.config = configToSave;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            message,
            type
        };

        this.deploymentLog.push(logEntry);

        // Emit log to renderer process
        if (this.onLogUpdate) {
            this.onLogUpdate(logEntry);
        }

        console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
    }

    async connectSSH(config) {
        return new Promise((resolve, reject) => {
            this.log('🔄 Connecting to SSH server...');

            const sshConfig = {
                host: config.host,
                port: parseInt(config.port),
                username: config.username,
                password: config.password,
                readyTimeout: 30000
            };

            this.ssh.connect(sshConfig);

            this.ssh.on('ready', () => {
                this.log('✅ SSH connection established', 'success');
                resolve();
            });

            this.ssh.on('error', (err) => {
                this.log(`❌ SSH connection failed: ${err.message}`, 'error');
                reject(err);
            });
        });
    }

    async executeCommand(command, description) {
        return new Promise((resolve, reject) => {
            this.log(`🔄 ${description}...`);

            this.ssh.exec(command, (err, stream) => {
                if (err) {
                    this.log(`❌ Command failed: ${err.message}`, 'error');
                    reject(err);
                    return;
                }

                let output = '';
                let errorOutput = '';

                stream.on('close', (code, signal) => {
                    if (code === 0) {
                        this.log(`✅ ${description} completed`, 'success');
                        resolve(output);
                    } else {
                        this.log(`❌ ${description} failed with exit code ${code}`, 'error');
                        reject(new Error(`Command failed with exit code ${code}`));
                    }
                });

                stream.on('data', (data) => {
                    output += data.toString();
                });

                stream.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });
            });
        });
    }

    async uploadFile(localPath, remotePath, description) {
        return new Promise((resolve, reject) => {
            this.log(`📤 Uploading ${description}...`);

            this.ssh.sftp((err, sftp) => {
                if (err) {
                    this.log(`❌ SFTP connection failed: ${err.message}`, 'error');
                    reject(err);
                    return;
                }

                // Get absolute local path
                const absoluteLocalPath = path.resolve(localPath);

                sftp.fastPut(absoluteLocalPath, remotePath, (err) => {
                    if (err) {
                        this.log(`❌ Upload failed for ${description}: ${err.message}`, 'error');
                        reject(err);
                    } else {
                        this.log(`✅ Upload completed: ${description}`, 'success');
                        resolve();
                    }
                    sftp.end();
                });
            });
        });
    }

    async createRemoteDirectory(dirPath) {
        try {
            await this.executeCommand(`mkdir -p ${dirPath}`, `Creating directory ${dirPath}`);
        } catch (err) {
            if (!err.message.includes('File exists')) {
                throw err;
            }
        }
    }

    async deploy(config, progressCallback) {
        if (this.deploymentInProgress) {
            throw new Error('Deployment already in progress');
        }

        this.deploymentInProgress = true;
        this.deploymentLog = [];

        try {
            // Save config for future use
            this.saveConfig(config);

            progressCallback && progressCallback(10, 'Connecting to SSH server...');
            await this.connectSSH(config);

            progressCallback && progressCallback(20, 'Creating backups...');
            await this.createBackups(config);

            progressCallback && progressCallback(30, 'Uploading migration files...');
            await this.uploadMigrations(config);

            progressCallback && progressCallback(50, 'Uploading backend files...');
            await this.uploadBackendFiles(config);

            progressCallback && progressCallback(70, 'Uploading authentication files...');
            await this.uploadAuthFiles(config);

            progressCallback && progressCallback(80, 'Setting file permissions...');
            await this.setFilePermissions(config);

            progressCallback && progressCallback(90, 'Running database migrations...');
            await this.runDatabaseMigrations(config);

            progressCallback && progressCallback(95, 'Verifying deployment...');
            const verificationPassed = await this.verifyDeployment(config);

            this.ssh.end();

            if (verificationPassed) {
                this.log('🎉 Deployment completed successfully!', 'success');
                progressCallback && progressCallback(100, 'Deployment completed successfully!');
            } else {
                this.log('⚠️ Deployment completed with warnings', 'warning');
                progressCallback && progressCallback(100, 'Deployment completed with warnings');
            }

            return {
                success: verificationPassed,
                log: this.deploymentLog
            };

        } catch (error) {
            this.log(`💥 Deployment failed: ${error.message}`, 'error');
            this.ssh.end();

            return {
                success: false,
                error: error.message,
                log: this.deploymentLog
            };

        } finally {
            this.deploymentInProgress = false;
        }
    }

    async createBackups(config) {
        this.log('📋 Creating backups of existing files...');
        const backupDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');

        try {
            await this.executeCommand(
                `cp ${config.remotePath}/auth/login.php ${config.remotePath}/auth/login.php.backup.${backupDate} 2>/dev/null || true`,
                'Backing up login.php'
            );
        } catch (err) {
            this.log('⚠️ Backup warning: login.php may not exist yet', 'warning');
        }
    }

    async uploadMigrations(config) {
        const appPath = require('electron').app.getAppPath();
        const projectRoot = path.dirname(path.dirname(appPath));

        await this.createRemoteDirectory(`${config.remotePath}/database-migrations`);

        const migrations = [
            {
                local: path.join(projectRoot, 'wokushop-api/database-migrations/001_add_ip_tracking.sql'),
                remote: `${config.remotePath}/database-migrations/001_add_ip_tracking.sql`,
                desc: 'IP tracking migration'
            },
            {
                local: path.join(projectRoot, 'wokushop-api/database-migrations/002_create_user_ip_sessions.sql'),
                remote: `${config.remotePath}/database-migrations/002_create_user_ip_sessions.sql`,
                desc: 'User IP sessions table'
            },
            {
                local: path.join(projectRoot, 'wokushop-api/database-migrations/003_create_system_settings.sql'),
                remote: `${config.remotePath}/database-migrations/003_create_system_settings.sql`,
                desc: 'System settings table'
            }
        ];

        for (const migration of migrations) {
            await this.uploadFile(migration.local, migration.remote, migration.desc);
        }
    }

    async uploadBackendFiles(config) {
        const appPath = require('electron').app.getAppPath();
        const projectRoot = path.dirname(path.dirname(appPath));

        const backendFiles = [
            {
                local: path.join(projectRoot, 'wokushop-api/config/ip-helper.php'),
                remote: `${config.remotePath}/config/ip-helper.php`,
                desc: 'IP Helper class'
            },
            {
                local: path.join(projectRoot, 'wokushop-api/config/session-manager.php'),
                remote: `${config.remotePath}/config/session-manager.php`,
                desc: 'Session Manager class'
            }
        ];

        for (const file of backendFiles) {
            await this.uploadFile(file.local, file.remote, file.desc);
        }
    }

    async uploadAuthFiles(config) {
        const appPath = require('electron').app.getAppPath();
        const projectRoot = path.dirname(path.dirname(appPath));

        const authFiles = [
            {
                local: path.join(projectRoot, 'wokushop-api/auth/login-updated.php'),
                remote: `${config.remotePath}/auth/login.php`,
                desc: 'Updated login endpoint'
            },
            {
                local: path.join(projectRoot, 'wokushop-api/auth/force-login.php'),
                remote: `${config.remotePath}/auth/force-login.php`,
                desc: 'Force login endpoint'
            }
        ];

        for (const file of authFiles) {
            await this.uploadFile(file.local, file.remote, file.desc);
        }
    }

    async setFilePermissions(config) {
        const commands = [
            `chmod 644 ${config.remotePath}/config/ip-helper.php`,
            `chmod 644 ${config.remotePath}/config/session-manager.php`,
            `chmod 644 ${config.remotePath}/auth/login.php`,
            `chmod 644 ${config.remotePath}/auth/force-login.php`,
            `chmod 644 ${config.remotePath}/database-migrations/*.sql`
        ];

        for (const command of commands) {
            try {
                await this.executeCommand(command, 'Setting file permissions');
            } catch (err) {
                this.log(`⚠️ Permission setting warning: ${err.message}`, 'warning');
            }
        }
    }

    async runDatabaseMigrations(config) {
        const migrations = [
            {
                file: '001_add_ip_tracking.sql',
                desc: 'Adding IP tracking to sessions table'
            },
            {
                file: '002_create_user_ip_sessions.sql',
                desc: 'Creating user_ip_sessions table'
            },
            {
                file: '003_create_system_settings.sql',
                desc: 'Creating system_settings table'
            }
        ];

        for (const migration of migrations) {
            const command = `cd ${config.remotePath}/database-migrations && mysql -u ${config.dbUser} -p'${config.dbPassword}' ${config.dbName} < ${migration.file}`;

            try {
                await this.executeCommand(command, migration.desc);
            } catch (err) {
                this.log(`⚠️ Migration ${migration.file} warning: ${err.message}`, 'warning');
            }
        }
    }

    async verifyDeployment(config) {
        const verificationCommands = [
            {
                command: `ls -la ${config.remotePath}/config/ip-helper.php`,
                desc: 'IP Helper file existence'
            },
            {
                command: `ls -la ${config.remotePath}/config/session-manager.php`,
                desc: 'Session Manager file existence'
            },
            {
                command: `php -l ${config.remotePath}/config/ip-helper.php`,
                desc: 'IP Helper PHP syntax'
            },
            {
                command: `php -l ${config.remotePath}/auth/login.php`,
                desc: 'Login PHP syntax'
            }
        ];

        let verificationPassed = true;

        for (const verification of verificationCommands) {
            try {
                await this.executeCommand(verification.command, verification.desc);
            } catch (err) {
                verificationPassed = false;
                this.log(`❌ Verification failed: ${verification.desc}`, 'error');
            }
        }

        return verificationPassed;
    }

    isDeploymentInProgress() {
        return this.deploymentInProgress;
    }

    getDeploymentLog() {
        return this.deploymentLog;
    }

    getSavedConfig() {
        return this.config;
    }
}

module.exports = AutoDeploymentManager;