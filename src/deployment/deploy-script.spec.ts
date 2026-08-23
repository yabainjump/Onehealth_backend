import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('production deployment script', () => {
  const script = readFileSync(
    join(process.cwd(), 'deploy-onehealth-backend.sh'),
    'utf8',
  );

  it('captures candidate and previous revisions before promotion', () => {
    expect(script).toContain('PREVIOUS_REVISION=');
    expect(script).toContain('CANDIDATE_REVISION=');
    expect(script.indexOf('PREVIOUS_REVISION=')).toBeLessThan(
      script.indexOf('git reset --hard "origin/$BRANCH"'),
    );
  });

  it('rolls back build, reload or readiness failures to the previous revision', () => {
    expect(script).toContain('rollback_candidate()');
    expect(script).toContain('trap rollback_on_error ERR');
    expect(script).toContain('git reset --hard "$PREVIOUS_REVISION"');
    expect(script).toContain('decision=rolled-back');
    expect(script).toContain('decision=rollback-failed');
  });

  it('checks readiness and public CORS after rollback without exposing env', () => {
    expect(script).toContain('verify_cluster_ready "$PREVIOUS_REVISION"');
    expect(script).toContain('verify_public_cors');
    expect(script).not.toMatch(/cat\s+[^\n]*\.env/);
    expect(script).not.toMatch(
      /echo\s+[^\n]*(JWT_SECRET|RATE_LIMIT_KEY_SECRET)/,
    );
  });
});
