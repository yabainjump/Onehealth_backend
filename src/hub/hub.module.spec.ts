import { MODULE_METADATA } from '@nestjs/common/constants';
import { CoordinationModule } from '../coordination/coordination.module';
import { RudolfModule } from '../rudolf/rudolf.module';
import { HubModule } from './hub.module';

describe('HubModule wiring', () => {
  it('exposes distributed quota dependencies to Hub route guards', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      HubModule,
    ) as unknown[];

    expect(imports).toEqual(
      expect.arrayContaining([CoordinationModule, RudolfModule]),
    );
  });
});
