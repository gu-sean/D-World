/**
 * `node --test --import ./client-tests/helpers/register.js client-tests/`의 `--import` 대상.
 *
 * React Native 전용 모듈은 Node에서 불러올 수 없으므로, 모듈 해석 단계에서
 * `fakeModules.js`의 가짜 구현으로 바꿔치기한다 (parts/mobile-client §9).
 * 가짜 모듈들은 `globalThis.__dworldTest` 레지스트리를 보고 동작하므로,
 * 각 테스트는 `resetTestEnv()`로 레지스트리를 초기화한 뒤 필요한 값만 바꾼다.
 */
import { register } from 'node:module';

register('./fakeModules.js', import.meta.url);
