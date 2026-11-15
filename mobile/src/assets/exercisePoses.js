/**
 * 운동별 자세 그림 데이터. `components/ExerciseIllustration.jsx`가 이 표를 읽어 그린다.
 *
 * 사람을 옆에서 본 모습(오른쪽을 바라봄)을 관절 좌표로 적는다. 한 장면은 120×100 칸이고
 * 바닥은 y=88이다. 관절 이름 끝의 N은 화면에 가까운 쪽 팔다리, F는 먼 쪽(흐리게 그림)이다.
 *
 *   head            머리 가운데
 *   neck, shoulder  목, 어깨
 *   elbowN·wristN   가까운 팔 / elbowF·wristF 먼 팔
 *   hip             엉덩이
 *   kneeN·ankleN·toeN  가까운 다리 / kneeF·ankleF·toeF 먼 다리
 *
 * 운동마다 `frames`(장면 순서대로)와 `thumbnail`(카드에 쓸 장면 번호)을 둔다.
 * 그림은 정확한 자세 교정용이 아니라 어떤 동작인지 한눈에 알아보게 하는 안내용이다.
 */

const STANDING = {
  head: [60, 14],
  neck: [60, 22],
  shoulder: [60, 26],
  elbowN: [62, 40],
  wristN: [63, 53],
  elbowF: [58, 40],
  wristF: [57, 53],
  hip: [60, 50],
  kneeN: [61, 68],
  ankleN: [60, 86],
  toeN: [67, 87],
  kneeF: [59, 68],
  ankleF: [58, 86],
  toeF: [65, 87],
};

/** 팔을 편 엎드린 자세 (푸시업 위, 버피 중간) */
const HIGH_PLANK = {
  head: [96, 57],
  neck: [89, 60],
  shoulder: [84, 62],
  elbowN: [84, 75],
  wristN: [84, 87],
  elbowF: [81, 75],
  wristF: [81, 87],
  hip: [52, 72.8],
  kneeN: [36, 78.3],
  ankleN: [22, 83],
  toeN: [20, 88],
  kneeF: [35, 79],
  ankleF: [21, 84],
  toeF: [19, 88],
};

export const EXERCISE_POSES = {
  push_up: {
    thumbnail: 0,
    frames: [
      { label: '팔 펴기', pose: HIGH_PLANK },
      {
        label: '가슴 내리기',
        pose: {
          head: [92, 70],
          neck: [85, 73],
          shoulder: [80, 74],
          elbowN: [71, 82],
          wristN: [84, 87],
          elbowF: [68, 82],
          wristF: [81, 87],
          hip: [52, 78.3],
          kneeN: [36, 80.8],
          ankleN: [22, 83],
          toeN: [20, 88],
          kneeF: [35, 81.4],
          ankleF: [21, 84],
          toeF: [19, 88],
        },
      },
    ],
  },

  squat: {
    thumbnail: 1,
    frames: [
      { label: '바로 서기', pose: STANDING },
      {
        label: '앉듯이 내려가기',
        pose: {
          head: [67, 29],
          neck: [64, 37],
          shoulder: [62, 40],
          elbowN: [76, 42],
          wristN: [88, 42],
          elbowF: [75, 44],
          wristF: [87, 44],
          hip: [52, 64],
          kneeN: [74, 70],
          ankleN: [62, 86],
          toeN: [69, 87],
          kneeF: [72, 71],
          ankleF: [60, 86],
          toeF: [67, 87],
        },
      },
    ],
  },

  lunge: {
    thumbnail: 1,
    frames: [
      { label: '바로 서기', pose: STANDING },
      {
        label: '한 발 앞으로 굽히기',
        pose: {
          head: [56, 29],
          neck: [56, 37],
          shoulder: [56, 40],
          elbowN: [58, 52],
          wristN: [60, 63],
          elbowF: [54, 52],
          wristF: [53, 63],
          hip: [56, 64],
          kneeN: [76, 66],
          ankleN: [77, 86],
          toeN: [84, 87],
          kneeF: [48, 82],
          ankleF: [32, 84],
          toeF: [28, 88],
        },
      },
    ],
  },

  plank: {
    thumbnail: 0,
    frames: [
      {
        label: '팔꿈치 대고 버티기',
        pose: {
          head: [92, 66],
          neck: [85, 68],
          shoulder: [80, 70],
          elbowN: [80, 86],
          wristN: [94, 86],
          elbowF: [77, 86],
          wristF: [91, 86],
          hip: [52, 76.3],
          kneeN: [36, 79.9],
          ankleN: [22, 83],
          toeN: [20, 88],
          kneeF: [35, 80.5],
          ankleF: [21, 84],
          toeF: [19, 88],
        },
      },
    ],
  },

  burpee: {
    thumbnail: 2,
    frames: [
      {
        label: '앉아서 손 짚기',
        pose: {
          head: [78, 43],
          neck: [73, 49],
          shoulder: [70, 52],
          elbowN: [76, 66],
          wristN: [78, 86],
          elbowF: [73, 67],
          wristF: [75, 86],
          hip: [54, 76],
          kneeN: [68, 70],
          ankleN: [58, 86],
          toeN: [65, 87],
          kneeF: [66, 72],
          ankleF: [56, 86],
          toeF: [63, 87],
        },
      },
      { label: '다리 뒤로 뻗기', pose: HIGH_PLANK },
      {
        label: '점프',
        pose: {
          head: [60, 11],
          neck: [60, 19],
          shoulder: [60, 22],
          elbowN: [68, 12],
          wristN: [74, 3],
          elbowF: [52, 12],
          wristF: [46, 3],
          hip: [60, 44],
          kneeN: [61, 62],
          ankleN: [60, 80],
          toeN: [66, 82],
          kneeF: [59, 62],
          ankleF: [58, 80],
          toeF: [64, 82],
        },
        airborne: true,
      },
    ],
  },

  running: {
    thumbnail: 0,
    frames: [
      {
        label: '달리기',
        pose: {
          head: [67, 14],
          neck: [64, 22],
          shoulder: [63, 25],
          elbowN: [54, 36],
          wristN: [57, 47],
          elbowF: [71, 36],
          wristF: [78, 29],
          hip: [58, 48],
          kneeN: [71, 59],
          ankleN: [66, 74],
          toeN: [72, 77],
          kneeF: [52, 65],
          ankleF: [40, 73],
          toeF: [37, 79],
        },
        airborne: true,
      },
    ],
  },
};

export default EXERCISE_POSES;
