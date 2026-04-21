module.exports = {
    apps: [
        {
            name: 'labz',
            script: './dist/main.js',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
                FORCE_COLOR: "1"
            },
            time: false,
            error_file: '.pm2/logs/labz-error.log',
            out_file: '.pm2/logs/labz-out.log',
            merge_logs: false,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            ignore_watch: ['node_modules', '.env', '.git', 'dist'],
            // Graceful shutdown
            kill_timeout: 5000,
            wait_ready: true,
            listen_timeout: 3000
        }
    ]
}