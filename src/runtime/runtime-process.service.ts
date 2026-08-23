import { Injectable } from '@nestjs/common';

@Injectable()
export class RuntimeProcessService {
  requestReplacement(): void {
    process.kill(process.pid, 'SIGINT');
  }
}
