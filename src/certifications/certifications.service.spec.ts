import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CertificationsService } from './certifications.service';
import { UploadService } from '../upload/upload.service';
import { MediaSignatureService } from '../media-access/media-signature.service';

describe('CertificationsService private documents', () => {
  const owner = new Types.ObjectId().toString();
  const findOne = { exec: jest.fn() };
  const findById = { exec: jest.fn() };
  const updateOne = { exec: jest.fn() };
  const requestModel = jest.fn();
  Object.assign(requestModel, { findOne: jest.fn(() => findOne) });
  const users = {
    findById: jest.fn(() => findById),
    updateOne: jest.fn(() => updateOne),
  };
  const uploads = {
    verifyPrivateUpload: jest.fn(),
    buildFileUrl: jest.fn((path: string) => `https://api.test${path}`),
  };
  const signer = {
    sign: jest.fn((value: string) => `${value}?exp=1&sig=valid`),
  };
  const service = new CertificationsService(
    requestModel as never,
    users as never,
    uploads as unknown as UploadService,
    signer as unknown as MediaSignatureService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findById.exec.mockResolvedValue({ isCertified: false });
    findOne.exec.mockResolvedValue(null);
    updateOne.exec.mockResolvedValue({});
  });

  it('refuses an arbitrary public post URL even when the applicant is authenticated', async () => {
    uploads.verifyPrivateUpload.mockReturnValue(null);
    await expect(
      service.create(owner, {
        documents: ['https://api.test/uploads/post/public.pdf'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(requestModel).not.toHaveBeenCalled();
  });

  it('stores a canonical private URL and signs only the authorized response', async () => {
    const canonical = 'https://api.test/uploads/certification/own.pdf';
    uploads.verifyPrivateUpload.mockReturnValue(canonical);
    requestModel.mockImplementation((input: { documents: string[] }) => {
      const request = {
        ...input,
        _id: new Types.ObjectId(),
        status: 'pending',
        createdAt: new Date(),
      };
      return { ...request, save: jest.fn().mockResolvedValue(request) };
    });
    const result = await service.create(owner, {
      documents: [`${canonical}?claim=owner-proof`],
    });
    expect(requestModel).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: [canonical],
      }),
    );
    expect(result.documents).toEqual([`${canonical}?exp=1&sig=valid`]);
    expect(uploads.verifyPrivateUpload).toHaveBeenCalledWith(
      `${canonical}?claim=owner-proof`,
      owner,
      'certification',
    );
  });

  it('never renews a legacy chat attachment saved in a certification request', () => {
    const response = service.toResponse({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(owner),
      documents: [
        'https://api.test/uploads/message/other-room.pdf?exp=1&sig=old',
      ],
      status: 'pending',
      createdAt: new Date(),
    } as never);
    expect(response.documents).toEqual(['']);
    expect(signer.sign).not.toHaveBeenCalled();
  });
});
