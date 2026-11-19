/**
 * API 응답은 브라우저·프록시가 저장하지 않게 한다(관리자·회원 데이터가 로그아웃 뒤나 공용 PC의
 * 캐시에 남지 않도록, ETag 재검증으로 오래된 응답을 다시 쓰지 않도록).
 * 헬스체크와 문서(Swagger)는 대상이 아니다.
 */
export function noStoreMiddleware(request, response, next) {
  const path = request.path ?? '';
  if (path.startsWith('/admin/') || path.startsWith('/api/')) {
    response.setHeader('Cache-Control', 'no-store');
  }
  next();
}
