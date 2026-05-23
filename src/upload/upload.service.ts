import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadService {
  buildFileUrl(req: { protocol: string; get: (name: string) => string }, path: string) {
    const host = req.get('host');
    return `${req.protocol}://${host}${path}`;
  }
}
