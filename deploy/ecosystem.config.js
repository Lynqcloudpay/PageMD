module.exports = {
  apps: [{
    name: 'emr-api',
    script: '../server/index.js',
    cwd: '/home/ubuntu/emr',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/home/ubuntu/emr/logs/pm2-error.log',
    out_file: '/home/ubuntu/emr/logs/pm2-out.log',
    log_file: '/home/ubuntu/emr/logs/pm2-combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads']
  }]
};



