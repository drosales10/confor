module.exports = {
  apps: [
    {
      name: "confor-web",
      cwd: ".",
      script: "cmd",
      args: "/c pnpm start",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: "confor-geo-worker",
      cwd: ".",
      script: "cmd",
      args: "/c pnpm worker:geo",
      env: {
        NODE_ENV: "production",
        GEO_WORKER_INTERVAL_MS: "5000",
        GEO_IMPORT_BATCH_SIZE: "500",
        GEO_RECALC_BATCH_SIZE: "200",
      },
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
    },
  ],
};
