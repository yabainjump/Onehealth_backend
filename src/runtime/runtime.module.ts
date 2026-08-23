import { Global, Module } from '@nestjs/common';
import { RuntimeDependencyProbeService } from './runtime-dependency-probe.service';
import { RuntimeLifecycleService } from './runtime-lifecycle.service';
import { RuntimeProcessService } from './runtime-process.service';
import { RuntimeReadinessService } from './runtime-readiness.service';

@Global()
@Module({
  providers: [
    RuntimeDependencyProbeService,
    RuntimeLifecycleService,
    RuntimeProcessService,
    RuntimeReadinessService,
  ],
  exports: [RuntimeLifecycleService, RuntimeReadinessService],
})
export class RuntimeModule {}
