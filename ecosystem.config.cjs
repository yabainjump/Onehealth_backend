module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || 'onehealth-backend',
      script: 'dist/main.js',
      cwd: __dirname,
      interpreter: process.env.NODE_BIN || 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
