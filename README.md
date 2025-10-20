# Wokushop Account Manager

A secure desktop application built with Electron.js for managing and distributing shared access to various online subscription services.

## Features

### Core Functionality
- **Secure Session Isolation**: Each account opens in an isolated browser window with separate cookies, cache, and login state
- **Multi-Service Support**: YouTube, Spotify, Netflix, Gemini AI, ChatGPT, and custom services
- **User Role Management**: Admin and regular user roles with different permissions
- **Device Registration**: Track which devices access the application
- **Activity Logging**: Complete audit trail of all user actions

### Security Features
- **JWT Authentication**: Secure token-based authentication
- **Domain Restriction**: Limit browsing to approved domains per service
- **Ad Blocking**: Integrated ad blocking for YouTube and Spotify
- **Session Sandboxing**: Complete isolation between different accounts
- **Encrypted Storage**: Secure local credential storage

### Admin Features
- **User Management**: Create, edit, and delete users
- **Account Management**: Add and manage shared service accounts
- **Account Assignment**: Control which users have access to which accounts
- **Activity History**: View detailed logs of all user activities
- **Chat Lock**: Lock specific AI chat conversations to individual users (for Gemini/ChatGPT)

## Technology Stack

### Frontend (Desktop App)
- **Electron.js**: Cross-platform desktop application framework
- **HTML/CSS/JavaScript**: Modern, responsive UI
- **Axios**: HTTP client for API communication
- **Electron Store**: Secure local data persistence

### Backend (API)
- **PHP 8.1+**: Server-side logic
- **MySQL**: Relational database
- **JWT**: Token-based authentication
- **WordOps**: Production server management

## Theme

The application features a modern gradient theme:
```
linear-gradient(108deg, #e77c58 3.84%, #ff480f 22.43%, #d60326 60.36%, #7d289d 96.59%)
```

## Project Structure

```
wokushop-account-manager/
├── src/
│   ├── main/
│   │   └── main.js              # Electron main process
│   ├── renderer/
│   │   ├── index.html           # Login page
│   │   └── dashboard.html       # Main dashboard
│   └── assets/
│       ├── css/
│       │   └── styles.css       # Application styles
│       └── js/
│           ├── api.js           # API client
│           ├── login.js         # Login logic
│           └── dashboard.js     # Dashboard logic
├── config/
│   └── config.js                # Application configuration
└── package.json

wokushop-api/
├── config/
│   ├── database.php             # Database connection
│   └── auth.php                 # Authentication helper
├── auth/
│   ├── login.php                # Login endpoint
│   └── logout.php               # Logout endpoint
├── accounts/
│   ├── list.php                 # List accounts
│   ├── create.php               # Create account
│   └── delete.php               # Delete account
├── users/
│   ├── list.php                 # List users
│   ├── create.php               # Create user
│   ├── delete.php               # Delete user
│   ├── assign-accounts.php      # Assign accounts
│   └── accounts.php             # Get user accounts
├── logs/
│   ├── list.php                 # List logs
│   └── create.php               # Create log
├── chatlocks/
│   ├── list.php                 # List chat locks
│   ├── create.php               # Create chat lock
│   └── delete.php               # Delete chat lock
├── stats/
│   └── dashboard.php            # Dashboard statistics
├── init.php                     # Database initialization
├── test.php                     # API test script
└── .htaccess                    # Apache configuration
```

## Installation

### Prerequisites
- Node.js 16+ and npm
- PHP 8.1+
- MySQL 5.7+ or MariaDB 10.3+
- WordOps (for production deployment)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/wokushop.git
   cd wokushop
   ```

2. **Install Electron app dependencies**
   ```bash
   cd wokushop-account-manager
   npm install
   ```

3. **Set up local PHP API**
   - Install XAMPP, WAMP, or MAMP
   - Copy `wokushop-api` to your web server directory
   - Update database credentials in `wokushop-api/config/database.php`
   - Access `http://localhost/wokushop-api/init.php` to initialize the database

4. **Configure the Electron app**
   - Edit `wokushop-account-manager/config/config.js`
   - Update `API_BASE_URL` to your local API URL

5. **Run the application**
   ```bash
   npm start
   ```

## Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

### Quick Start

1. **Deploy PHP API on WordOps**
   ```bash
   sudo wo site create api.yourdomain.com --php81 --mysql --letsencrypt
   ```

2. **Upload API files and initialize database**
   ```bash
   cd /var/www/api.yourdomain.com/htdocs
   # Upload files
   # Access https://api.yourdomain.com/init.php
   ```

3. **Build Electron app**
   ```bash
   npm run build:win   # Windows
   npm run build:mac   # macOS
   npm run build:linux # Linux
   ```

## Usage

### Default Credentials
- **Username**: admin
- **Password**: admin123

**Important**: Change the default password immediately after first login!

### For Admins

1. **Add Accounts**: Navigate to Accounts → Add Account
2. **Add Users**: Navigate to Users → Add User
3. **Assign Accounts**: Click "Assign Accounts" for a user and select accounts
4. **View Activity**: Check History tab for all user activities
5. **Manage Chat Locks**: Use Chat Lock tab for AI service conversation management

### For Users

1. **Login**: Use credentials provided by admin
2. **View Accounts**: See all assigned accounts on the Accounts page
3. **Launch Session**: Click "Launch Session" to open an isolated browser window
4. **Browse Safely**: Only approved domains are accessible in session windows

## Database Schema

### Tables
- **users**: User accounts and roles
- **accounts**: Shared service accounts
- **user_accounts**: User-account assignments
- **usage_logs**: Activity audit trail
- **domain_restrictions**: Allowed domains per service
- **chat_locks**: AI chat conversation locks
- **sessions**: Active user sessions

## API Reference

See [DEPLOYMENT.md](DEPLOYMENT.md#api-endpoints-reference) for complete API documentation.

## Security Considerations

1. **Change default credentials** immediately
2. **Use HTTPS** for API in production
3. **Update JWT secret key** in `config/auth.php`
4. **Enable firewall** on server
5. **Regular backups** of database and files
6. **Monitor logs** for suspicious activity

## Features in Detail

### Session Isolation
Each account uses Electron's partition feature to create completely isolated browser sessions. This ensures:
- Separate cookies and cache
- Independent login states
- No interference between users
- Enhanced security and privacy

### Domain Restriction
Prevents misuse by limiting browsing to specific domains:
- YouTube sessions can only access youtube.com
- Spotify sessions can only access spotify.com
- Attempts to access other sites are blocked
- Configurable per service type

### Ad Blocking
Built-in ad blocking for better user experience:
- Blocks common ad networks
- Removes tracking scripts
- Works on YouTube and Spotify
- Can be extended to other services

### Chat Lock
Unique feature for AI services (Gemini, ChatGPT):
- Admin can lock specific conversation threads
- Locked chats are exclusive to one user
- Prevents others from viewing or disrupting conversations
- Ideal for maintaining conversation context

## Troubleshooting

### Common Issues

**Electron app won't start**
- Check Node.js version (16+)
- Run `npm install` again
- Delete `node_modules` and reinstall

**Can't connect to API**
- Verify API URL in `config/config.js`
- Check if API is running
- Test API: `curl https://api.yourdomain.com/test.php`

**Login fails**
- Verify database is initialized
- Check database credentials
- Look at PHP error logs

**Session windows blocked**
- Check domain restrictions
- Verify partition ID is unique
- Check console for errors

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License

## Support

For issues, questions, or feature requests, please create an issue on the GitHub repository.

## Credits

Developed by WokuShop Team

---

**Version**: 1.0.0
**Last Updated**: 2024
