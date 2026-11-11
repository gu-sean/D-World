/**
 * 운동 종류 6종 (팀 문서 04 §4 고정, 목표 범위는 11 §8.2)
 * 계획 생성 요청(I03 exerciseTypes)과 앱 기준 데이터(A19)가 같이 쓴다.
 * 인증 방식: 푸시업·버피·스쿼트·런지·플랭크는 카메라, 러닝은 센서
 */
export const EXERCISE_TYPES = Object.freeze([
  {
    code: 'push_up',
    name: '푸시업',
    verificationMethod: 'camera',
    targetUnit: 'reps',
    minTarget: 1,
    maxTarget: 100,
  },
  {
    code: 'burpee',
    name: '버피 테스트',
    verificationMethod: 'camera',
    targetUnit: 'reps',
    minTarget: 1,
    maxTarget: 50,
  },
  {
    code: 'squat',
    name: '스쿼트',
    verificationMethod: 'camera',
    targetUnit: 'reps',
    minTarget: 1,
    maxTarget: 200,
  },
  {
    code: 'lunge',
    name: '런지',
    verificationMethod: 'camera',
    targetUnit: 'reps',
    minTarget: 2,
    maxTarget: 100,
  },
  {
    code: 'plank',
    name: '플랭크',
    verificationMethod: 'camera',
    targetUnit: 'seconds',
    minTarget: 10,
    maxTarget: 90,
  },
  {
    code: 'running',
    name: '러닝',
    verificationMethod: 'sensor',
    targetUnit: 'meters',
    minTarget: 500,
    maxTarget: 21000,
  },
]);
