import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC } from './auth.constants.js';

/** 인증 없이 호출 가능, 전역 guard는 기본이 "인증 필요" */
export const Public = () => SetMetadata(IS_PUBLIC, true);
