'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { apps } = require('../ecosystem.config.cjs');

assert.equal(apps.length, 1, 'exactly one PM2 application is expected');
const app = apps[0];

assert.equal(app.instances, 2, 'the first increment requires exactly two workers');
assert.equal(app.exec_mode, 'cluster');
assert.equal(app.wait_ready, true);
assert.equal(app.autorestart, true);
assert.ok(app.listen_timeout >= 10_000);
assert.ok(app.kill_timeout > Number(app.env.SHUTDOWN_TIMEOUT_MS));
assert.ok(app.max_restarts > 0);
assert.ok(app.restart_delay >= 1_000);

const nginxConfig = readFileSync(
  join(__dirname, '..', 'ops', 'nginx', 'onehealth-backend.conf.example'),
  'utf8',
);
assert.match(nginxConfig, /proxy_next_upstream\s+off\s*;/);
assert.doesNotMatch(nginxConfig, /proxy_next_upstream[^;]*non_idempotent/);

console.log(
  'Infrastructure configuration valid: two ready-gated workers and no Nginx request replay.',
);
