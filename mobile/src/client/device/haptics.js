/**
 * 보상 순간의 가벼운 진동.
 *
 * 켜기/끄기는 기기에만 저장한다(키체인 `dworld.prefs`). 아직 읽기 전이면 켜진 것으로 본다.
 * 진동이 안 되는 기기·권한 문제는 조용히 넘어간다 — 연출일 뿐이라 흐름을 막지 않는다.
 */
import { Vibration } from 'react-native';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'dworld.prefs';
const USERNAME = 'haptics';

let enabled = true;
let loaded = false;
const listeners = new Set();

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const saved = await Keychain.getGenericPassword({ service: SERVICE });
    if (saved) {
      enabled = saved.password !== 'off';
      listeners.forEach((fn) => fn(enabled));
    }
  } catch {
    // 못 읽으면 켜진 상태로 둔다.
  }
}

/** 설정 화면이 현재 값을 읽는다. */
export async function isEnabled() {
  await load();
  return enabled;
}

/** 켜기/끄기를 바꾸고 저장한다. */
export async function setEnabled(value) {
  enabled = !!value;
  loaded = true;
  listeners.forEach((fn) => fn(enabled));
  try {
    await Keychain.setGenericPassword(USERNAME, enabled ? 'on' : 'off', { service: SERVICE });
  } catch {
    // 저장 실패는 이번 실행에서만 유효하다.
  }
}

/** @param {(value: boolean) => void} fn */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function buzz(ms) {
  await load();
  if (!enabled) return;
  try {
    Vibration.vibrate(ms);
  } catch {
    // 진동을 못 내도 그만이다.
  }
}

/** 가벼운 한 번 (업적·미션 완료) */
export const light = () => buzz(25);
/** 중간 세기 한 번 (진화) */
export const medium = () => buzz(55);

export default { isEnabled, setEnabled, subscribe, light, medium };
