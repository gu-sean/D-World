import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import {
  createObjectStorage,
  OBJECT_STORAGE,
} from './storage/object-storage.js';

/** 수행 회차·판정이 import해서 파일 정리·관리자용 조회 URL을 사용 */
@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: OBJECT_STORAGE,
      useFactory: async (config) => {
        const storage = createObjectStorage(config);
        if (config.get('R2_CREATE_BUCKET')) await storage.ensureBucket?.();
        return storage;
      },
      inject: [ConfigService],
    },
  ],
  exports: [MediaService, OBJECT_STORAGE],
})
export class MediaModule {}
