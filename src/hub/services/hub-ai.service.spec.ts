import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { UserRole } from '../../users/schemas/user.schema';
import { OpenRouterProviderService } from '../../rudolf/openrouter-provider.service';
import { HubRepository } from '../repositories/hub.repository';
import { HubAiService } from './hub-ai.service';

describe('HubAiService external provider gate', () => {
  const listObservations = jest.fn().mockResolvedValue({ items: [] });
  const createAudit = jest.fn().mockResolvedValue(undefined);
  const providerComplete = jest.fn().mockResolvedValue('Brouillon');
  const user = {
    id: 'test-user',
    role: UserRole.USER,
    hubRoles: [],
    hubCountryCodes: ['CM'],
  } as unknown as PublicUser;
  const repository = {
    listObservations,
    createAudit,
  } as unknown as HubRepository;
  const provider = {
    complete: providerComplete,
    model: 'meta-llama/llama-3.3-70b-instruct',
  } as unknown as OpenRouterProviderService;

  beforeEach(() => jest.clearAllMocks());

  it('does not export Hub context without explicit institutional approval', async () => {
    const config = {
      get: jest.fn().mockReturnValue(false),
    } as unknown as ConfigService;
    const service = new HubAiService(repository, provider, config);

    await expect(
      service.assistant({ question: 'Que montrent les données ?' }, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(providerComplete).not.toHaveBeenCalled();
    expect(createAudit).not.toHaveBeenCalled();
  });

  it('uses only the server-scoped Hub observations when enabled', async () => {
    const config = {
      get: jest.fn().mockReturnValue(true),
    } as unknown as ConfigService;
    const service = new HubAiService(repository, provider, config);

    await expect(
      service.assistant({ question: 'Que montrent les données ?' }, user),
    ).resolves.toMatchObject({
      content: 'Brouillon',
      humanValidationRequired: true,
    });
    expect(listObservations).toHaveBeenCalledWith(
      expect.objectContaining({ allowedCountryCodes: ['CM'] }),
    );
    expect(providerComplete).toHaveBeenCalledTimes(1);
    expect(createAudit).toHaveBeenCalledTimes(1);
  });
});
