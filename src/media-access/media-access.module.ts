import { Global, Module } from '@nestjs/common';
import { MediaSignatureService } from './media-signature.service';

/**
 * Global : la signature des medias prives est necessaire partout ou une URL
 * `/uploads/message/` est renvoyee (chat, upload) ou verifiee (statique).
 */
@Global()
@Module({
  providers: [MediaSignatureService],
  exports: [MediaSignatureService],
})
export class MediaAccessModule {}
