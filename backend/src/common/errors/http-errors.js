import { HttpStatus } from '@nestjs/common';
import { AppException } from './app-exception.js';

const make = (status) => (code, message, details) =>
  new AppException(status, code, message, details ? { details } : {});

/** 서비스 공통 도메인 오류 생성기: (code, message, details?) → AppException */
export const httpError = (status, code, message, details) =>
  make(status)(code, message, details);
export const notFound = make(HttpStatus.NOT_FOUND);
export const conflict = make(HttpStatus.CONFLICT);
export const unprocessable = make(HttpStatus.UNPROCESSABLE_ENTITY);
