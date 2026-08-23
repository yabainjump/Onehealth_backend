import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('production deployment script', () => {
  const script = readFileSync(
    join(process.cwd(), 'deploy-onehealth-backend.sh'),
    'utf8',
  );
  const jenkinsWrapper = readFileSync(
    join(process.cwd(), 'ops', 'jenkins', 'deploy-onehealth-backend'),
    'utf8',
  );
  const jenkinsfile = readFileSync(join(process.cwd(), 'Jenkinsfile'), 'utf8');

  it('captures candidate and previous revisions before promotion', () => {
    expect(script).toContain('PREVIOUS_REVISION=');
    expect(script).toContain('CANDIDATE_REVISION=');
    expect(script.indexOf('PREVIOUS_REVISION=')).toBeLessThan(
      script.indexOf('git reset --hard "$DEPLOY_TARGET"'),
    );
  });

  it('deploys the exact commit tested by Jenkins', () => {
    expect(jenkinsfile).toContain('DEPLOY_REVISION="$(git rev-parse HEAD)"');
    expect(jenkinsfile).toContain('test "$DEPLOY_REVISION" = "$GIT_COMMIT"');
    expect(jenkinsWrapper).toContain('readonly DEPLOY_REVISION="$1"');
    expect(jenkinsWrapper).toContain('DEPLOY_REVISION="$DEPLOY_REVISION"');
    expect(script).toContain('git merge-base --is-ancestor');
    expect(script).toContain('git reset --hard "$DEPLOY_TARGET"');
    expect(script).toContain('[ "$CANDIDATE_REVISION" != "$DEPLOY_REVISION" ]');
  });

  it('rolls back build, reload or readiness failures to the previous revision', () => {
    expect(script).toContain('rollback_candidate()');
    expect(script).toContain('trap rollback_on_error ERR');
    expect(script).toContain('git reset --hard "$PREVIOUS_REVISION"');
    expect(script).toContain('decision=rolled-back');
    expect(script).toContain('decision=rollback-failed');
  });

  it('recreates a legacy fork process before enabling the two-worker cluster', () => {
    expect(script).toContain('has_expected_cluster_shape()');
    expect(script).toContain('start_or_reload_cluster()');
    expect(script).toContain('exec_mode === "cluster_mode"');
    expect(script).toContain('apps.length === 2');
    expect(script).toContain('"$PM2_BIN" delete "$PM2_APP_NAME"');
    expect(script).toContain(
      '"$PM2_BIN" start ecosystem.config.cjs --update-env',
    );
  });

  it('checks readiness and public CORS after rollback without exposing env', () => {
    expect(script).toContain('restore_previous_runtime');
    expect(script).toContain('verify_legacy_runtime');
    expect(script).toContain('verify_public_cors');
    expect(script).not.toMatch(/cat\s+[^\n]*\.env/);
    expect(script).not.toMatch(
      /echo\s+[^\n]*(JWT_SECRET|RATE_LIMIT_KEY_SECRET)/,
    );
  });
});
