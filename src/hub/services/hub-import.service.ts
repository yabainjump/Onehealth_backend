import { createHash, randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import {
  ConfirmHubImportDto,
  CreateHubImportPreviewDto,
  ListHubImportBatchesDto,
  ListHubQualityIssuesDto,
} from '../dto/hub-import.dto';
import { resolveHubCountryScope } from '../hub-access-scope';
import {
  HUB_IMPORT_DICTIONARY,
  HUB_IMPORT_MAPPING_VERSION,
  HUB_IMPORT_MAX_CONTENT_BYTES,
  type HubImportValidationIssue,
} from '../ingestion/hub-import.constants';
import {
  HubImportParseError,
  parseHubImport,
} from '../ingestion/hub-import.parser';
import { HubImportRepository } from '../repositories/hub-import.repository';
import { HubRepository } from '../repositories/hub.repository';

@Injectable()
export class HubImportService {
  constructor(
    private readonly importRepository: HubImportRepository,
    private readonly hubRepository: HubRepository,
  ) {}

  dictionary() {
    return {
      version: HUB_IMPORT_MAPPING_VERSION,
      fields: HUB_IMPORT_DICTIONARY,
      formats: ['CSV', 'JSON', 'GEOJSON'],
      maxFileBytes: HUB_IMPORT_MAX_CONTENT_BYTES,
      maxRecords: 500,
      simulatedOnly: true,
    };
  }

  async preview(dto: CreateHubImportPreviewDto, user: PublicUser) {
    this.assertCountryScope(dto.countryCode, user);
    if (Buffer.byteLength(dto.content, 'utf8') > HUB_IMPORT_MAX_CONTENT_BYTES) {
      throw new PayloadTooLargeException(
        'Le fichier dépasse la limite de 48 Kio.',
      );
    }
    if (
      !(await this.importRepository.sharingPolicyExists(
        dto.sharingPolicyId,
        dto.countryCode,
      ))
    ) {
      throw new BadRequestException(
        'La politique de partage simulée ne correspond pas au pays sélectionné.',
      );
    }

    let parsed: ReturnType<typeof parseHubImport>;
    try {
      parsed = parseHubImport({
        content: dto.content,
        format: dto.format,
        sourceSystem: dto.sourceSystem,
        sourceInstance: dto.sourceInstance,
        countryCode: dto.countryCode,
        mapping: dto.mapping,
      });
    } catch (error) {
      if (error instanceof HubImportParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const existing = await this.importRepository.existingSourceRecordIds({
      sourceSystem: dto.sourceSystem,
      sourceInstance: dto.sourceInstance,
      countryCode: dto.countryCode,
      sourceRecordIds: parsed.candidates.map((item) => item.sourceRecordId),
    });
    const candidates = parsed.candidates.filter(
      (candidate) => !existing.has(candidate.sourceRecordId),
    );
    const duplicateIssues: HubImportValidationIssue[] = parsed.candidates
      .filter((candidate) => existing.has(candidate.sourceRecordId))
      .map((candidate) => ({
        rowNumber: candidate.sourceRowNumber,
        sourceRecordId: candidate.sourceRecordId,
        code: 'DUPLICATE_EXISTING',
        field: 'sourceRecordId',
        message: 'Cet identifiant existe déjà dans le Hub et sera ignoré.',
        severity: 'WARNING',
      }));
    const issues = [...parsed.issues, ...duplicateIssues];
    const batchId = `IMP-${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
    const batch = await this.importRepository.createPreview({
      batch: {
        batchId,
        actorId: user.id,
        fileName: dto.fileName,
        format: dto.format,
        sourceSystem: dto.sourceSystem,
        sourceInstance: dto.sourceInstance,
        countryCode: dto.countryCode,
        sharingPolicyId: dto.sharingPolicyId,
        contentSha256: createHash('sha256').update(dto.content).digest('hex'),
        mappingVersion: HUB_IMPORT_MAPPING_VERSION,
        mapping: dto.mapping,
        candidates: candidates as unknown as Array<Record<string, unknown>>,
        totalRecords: parsed.totalRecords,
        acceptedRecords: candidates.length,
        rejectedRecords: parsed.totalRecords - parsed.candidates.length,
        duplicateRecords: existing.size,
        status: 'PREVIEW',
        isDemo: true,
        expiresAt,
      },
      issues: issues.map((item) => ({
        issueId: `DQI-${randomUUID()}`,
        batchId,
        rowNumber: item.rowNumber,
        sourceRecordId: item.sourceRecordId,
        countryCode: dto.countryCode,
        sourceSystem: dto.sourceSystem,
        code: item.code,
        field: item.field,
        message: item.message,
        severity: item.severity,
        isDemo: true,
      })),
    });
    await this.hubRepository.createAudit({
      entityType: 'import-batch',
      entityId: batchId,
      action: 'SIMULATED_IMPORT_PREVIEWED',
      actorId: user.id,
      actorType: 'USER',
      countryCode: dto.countryCode,
      isDemo: true,
      metadata: {
        sourceSystem: dto.sourceSystem,
        format: dto.format,
        totalRecords: parsed.totalRecords,
        acceptedRecords: candidates.length,
        issueCount: issues.length,
      },
    });
    return {
      ...this.presentBatch(batch),
      issues: issues.slice(0, 100),
      sample: candidates.slice(0, 10).map((item) => ({
        canonicalId: item.canonicalId,
        sourceRecordId: item.sourceRecordId,
        title: item.title,
        observedAt: item.observedAt,
        severity: item.severity,
      })),
    };
  }

  async confirm(batchId: string, _dto: ConfirmHubImportDto, user: PublicUser) {
    const batch = await this.importRepository.claimBatch({
      batchId,
      actorId: user.id,
      allowedCountryCodes: resolveHubCountryScope(user),
    });
    if (!batch) {
      throw new ConflictException(
        "Le lot est introuvable, expiré, déjà traité ou n'appartient pas à cet administrateur.",
      );
    }
    try {
      const result = await this.importRepository.ingestClaimedBatch(batch);
      await this.importRepository.completeBatch(batchId);
      await this.hubRepository.createAudit({
        entityType: 'import-batch',
        entityId: batchId,
        action: 'SIMULATED_IMPORT_CONFIRMED',
        actorId: user.id,
        actorType: 'USER',
        countryCode: batch.countryCode,
        isDemo: true,
        metadata: result,
      });
      return {
        batchId,
        status: 'COMPLETED' as const,
        ...result,
        simulated: true,
        message:
          'Import simulé terminé. Les lignes acceptées sont des observations non vérifiées.',
      };
    } catch {
      await this.importRepository.failBatch(batchId, 'INGESTION_FAILED');
      throw new ConflictException(
        "L'import n'a pas pu être terminé. Le lot reste réessayable sans duplication.",
      );
    }
  }

  async listBatches(query: ListHubImportBatchesDto, user: PublicUser) {
    const result = await this.importRepository.listBatches({
      allowedCountryCodes: resolveHubCountryScope(user),
      page: query.page,
      limit: query.limit,
    });
    return {
      items: result.items.map((item) => this.presentBatch(item)),
      total: result.total,
      page: query.page,
      limit: query.limit,
      pages: Math.max(1, Math.ceil(result.total / query.limit)),
      simulated: true,
    };
  }

  async listQualityIssues(query: ListHubQualityIssuesDto, user: PublicUser) {
    const result = await this.importRepository.listQualityIssues({
      allowedCountryCodes: resolveHubCountryScope(user),
      countryCode: query.countryCode,
      sourceSystem: query.sourceSystem,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
    return {
      items: result.items.map((item) => ({
        issueId: item.issueId,
        batchId: item.batchId,
        rowNumber: item.rowNumber,
        sourceRecordId: item.sourceRecordId,
        countryCode: item.countryCode,
        sourceSystem: item.sourceSystem,
        code: item.code,
        field: item.field,
        message: item.message,
        severity: item.severity,
        status: item.status,
        createdAt: item.createdAt,
        simulated: item.isDemo,
      })),
      total: result.total,
      page: query.page,
      limit: query.limit,
      pages: Math.max(1, Math.ceil(result.total / query.limit)),
      simulated: true,
    };
  }

  private assertCountryScope(countryCode: string, user: PublicUser): void {
    const scope = resolveHubCountryScope(user);
    if (scope && !scope.includes(countryCode)) {
      throw new BadRequestException(
        "Le pays n'appartient pas au périmètre autorisé.",
      );
    }
  }

  private presentBatch(batch: {
    batchId: string;
    fileName: string;
    format: string;
    sourceSystem: string;
    sourceInstance: string;
    countryCode: string;
    mappingVersion: string;
    totalRecords: number;
    acceptedRecords: number;
    rejectedRecords: number;
    duplicateRecords: number;
    status: string;
    expiresAt: Date;
    confirmedAt: Date | null;
    failureCode: string;
    isDemo: boolean;
    createdAt?: Date;
  }) {
    return {
      batchId: batch.batchId,
      fileName: batch.fileName,
      format: batch.format,
      sourceSystem: batch.sourceSystem,
      sourceInstance: batch.sourceInstance,
      countryCode: batch.countryCode,
      mappingVersion: batch.mappingVersion,
      counts: {
        total: batch.totalRecords,
        accepted: batch.acceptedRecords,
        rejected: batch.rejectedRecords,
        duplicates: batch.duplicateRecords,
      },
      status: batch.status,
      expiresAt: batch.expiresAt,
      confirmedAt: batch.confirmedAt,
      failureCode: batch.failureCode,
      createdAt: batch.createdAt ?? null,
      simulated: batch.isDemo,
    };
  }
}
