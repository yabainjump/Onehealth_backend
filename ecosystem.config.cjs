const boundedInteger = (name, fallback, minimum, maximum) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
};

const instances = boundedInteger('WEB_CONCURRENCY', 2, 2, 2);
const shutdownTimeoutMs = boundedInteger(
  'SHUTDOWN_TIMEOUT_MS',
  15_000,
  5_000,
  120_000,
);

module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || 'onehealth-backend',
      script: 'dist/main.js',
      cwd: __dirname,
      interpreter: process.env.NODE_BIN || 'node',
      instances,
      exec_mode: 'cluster',
      instance_var: 'NODE_APP_INSTANCE',
      wait_ready: true,
      listen_timeout: 60_000,
      kill_timeout: shutdownTimeoutMs + 5_000,
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 2_000,
      max_memory_restart: '512M',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        // Doit être explicite pour qu'un `startOrReload --update-env`
        // remplace bien la révision annoncée par les deux workers.
        APP_VERSION: process.env.APP_VERSION || '0.0.1',
        WEB_CONCURRENCY: `${instances}`,
        SHUTDOWN_TIMEOUT_MS: `${shutdownTimeoutMs}`,
        PM2_KILL_SIGNAL: 'SIGINT',
      },
    },
  ],
};
