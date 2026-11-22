// PM2 process file:  pm2 start deploy/ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    {
      name: 'jencorps-api',
      cwd: __dirname + '/../backend',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M',
    },
  ],
};
