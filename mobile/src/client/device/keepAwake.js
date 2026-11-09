/**
 * 화면 켜 두기 (parts/mobile-client §7.2).
 * 러닝 중(`running`·`paused`)에만 켠다. 끄는 걸 잊으면 배터리를 먹는다.
 */
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/** 러닝 흐름이 쓰는 태그. 다른 곳에서 꺼도 서로 간섭하지 않게 이름을 붙인다. */
export const RUN_TAG = 'run';

/** @param {string} [tag] */
export async function activate(tag = RUN_TAG) {
  try {
    await activateKeepAwakeAsync(tag);
  } catch {
    // 화면을 못 켜 둬도 기록은 계속한다.
  }
}

/** @param {string} [tag] */
export async function deactivate(tag = RUN_TAG) {
  try {
    await deactivateKeepAwake(tag);
  } catch {
    // 이미 꺼졌으면 그만이다.
  }
}

export default { activate, deactivate, RUN_TAG };
