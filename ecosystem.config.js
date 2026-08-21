module.exports = {
  apps: [
    {
      name: 'hrms-backend',
      cwd: __dirname,
      script: 'dist/src/main.js',
      // Single instance (fork mode), not cluster: the BullMQ onboarding
      // scheduler runs cron-based jobs (link expiry, reminders) with no
      // distributed lock — running >1 instance would fire those jobs
      // once per instance. Revisit only if a lock (e.g. @nestjs/schedule's
      // distributed-lock pattern, or a Redis-based leader election) is
      // added first.
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '500M',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
