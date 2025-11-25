module.exports = {
  // API Configuration - Update this with your WordOps hosted PHP API URL
  API_BASE_URL: process.env.API_URL || 'http://localhost/wokushop-api',

  // Application Settings
  APP_NAME: 'WokuShop App',
  APP_VERSION: '1.0.20',

  // Theme Colors
  THEME: {
    gradient: 'linear-gradient(108deg, #e77c58 3.84%, #ff480f 22.43%, #d60326 60.36%, #7d289d 96.59%)',
    primary: '#e77c58',
    secondary: '#d60326',
    accent: '#7d289d',
    background: '#1a1a2e',
    surface: '#16213e',
    text: '#ffffff',
    textSecondary: '#a0a0a0'
  },

  // Session Settings
  SESSION: {
    timeout: 3600000, // 1 hour in milliseconds
    maxDevices: 5
  },

  // Security Settings
  SECURITY: {
    passwordMinLength: 8,
    maxLoginAttempts: 5,
    lockoutDuration: 900000 // 15 minutes in milliseconds
  },

  // Service Types
  SERVICE_TYPES: {
    YOUTUBE: 'youtube',
    SPOTIFY: 'spotify',
    NETFLIX: 'netflix',
    GEMINI: 'gemini',
    CHATGPT: 'chatgpt',
    QUILLBOT: 'quillbot',
    CUSTOM: 'custom'
  },

  // Default Domain Restrictions
  DOMAIN_RESTRICTIONS: {
    youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'accounts.google.com', 'accounts.youtube.com'],
    spotify: ['spotify.com', 'www.spotify.com', 'open.spotify.com'],
    netflix: ['netflix.com', 'www.netflix.com'],
    gemini: ['gemini.google.com', 'aistudio.google.com', 'accounts.google.com', 'google.com', 'www.google.com', 'gstatic.com'],
    chatgpt: ['chat.openai.com', 'chatgpt.com', 'auth0.openai.com', 'auth.openai.com'],
    quillbot: ['quillbot.com', 'www.quillbot.com', 'app.quillbot.com', 'accounts.quillbot.com']
  }
};
