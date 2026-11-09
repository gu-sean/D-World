// vitest의 describe.skipIf를 jest에서 같은 뜻으로 제공 (DATABASE_URL이 없으면 DB 테스트를 건너뜀)
describe.skipIf = (condition) => (condition ? describe.skip : describe);

// vitest의 expect(값, 실패 메시지)를 jest에서도 받도록 두 번째 인자는 무시한다
const jestExpect = globalThis.expect;
globalThis.expect = Object.assign((actual) => jestExpect(actual), jestExpect);
