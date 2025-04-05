module.exports = {
  apps: [
    {
      name: "panel",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        EVILGINX_DB_PATH: "../../../.evilginx/data.db",
      },
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G",
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
