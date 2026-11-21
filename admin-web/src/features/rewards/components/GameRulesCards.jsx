// 앱(모바일) 기준의 보상·성장 규칙 안내(읽기 전용). 값은 ./gameRules.js
import { Alert, Descriptions } from 'antd';
import { t } from '../../../i18n/index.js';
import { GAME_RULES as R } from './gameRules.js';

const point = (n) => `${n.toLocaleString()} P`;

/** 하루 한도와 미션 1회 보상 */
export function DailyLimitRules() {
  return (
    <>
      <Alert
        showIcon
        type="info"
        className="mb-16"
        title={t(
          '앱에서 실제로 적용되는 규칙이에요. 값은 서버에 고정돼 있어 이 화면에서 바꾸지 않아요.',
        )}
      />
      <Descriptions bordered column={1} style={{ maxWidth: 560 }}>
        <Descriptions.Item label={t('하루 포인트 한도')}>
          {t(
            '{0} (세부 미션 {1}개 × {2})',
            point(R.dailyPointLimit),
            R.dailyPointLimit / R.missionPoints,
            point(R.missionPoints),
          )}
        </Descriptions.Item>
        <Descriptions.Item label={t('하루 펫 XP')}>
          {t('{0} (하루 첫 미션 1회만 받아요)', R.dailyPetXp)}
        </Descriptions.Item>
        <Descriptions.Item label={t('미션 1회 보상')}>
          {t('{0} · 펫 XP {1}', point(R.missionPoints), R.missionPetXp)}
        </Descriptions.Item>
        <Descriptions.Item label={t('하루 한도와 별개')}>
          {t('업적(배지)·챌린지·스트릭 보상은 하루 한도 없이 전부 지급돼요')}
        </Descriptions.Item>
      </Descriptions>
      <Alert
        type="warning"
        style={{ marginTop: 16, maxWidth: 560 }}
        title={t(
          '한도를 넘는 포인트는 지급되지 않고, 펫 XP는 지갑에 쌓였다가 사용자가 "경험치 주기"로 펫에게 먹여요.',
        )}
      />
    </>
  );
}

/** 펫 성장 단계 기준 */
export function GrowthRules() {
  return (
    <>
      <Alert
        showIcon
        type="info"
        className="mb-16"
        title={t(
          '앱에서 실제로 적용되는 규칙이에요. 모든 펫 종류에 똑같이 적용되고 이 화면에서 바꾸지 않아요.',
        )}
      />
      <Descriptions bordered column={1} style={{ maxWidth: 560 }}>
        <Descriptions.Item label={t('알 → 아기')}>
          {t('세부 미션 {0}개 완료 ({1} XP 상당)', R.hatchMissions, R.babyXp)}
        </Descriptions.Item>
        <Descriptions.Item label={t('아기 → 성체')}>{t('경험치 {0}', R.adultXp)}</Descriptions.Item>
        <Descriptions.Item label={t('경험치 주기')}>
          {t('한 번에 {0}씩 지갑에서 펫에게 먹여요', R.feedXp)}
        </Descriptions.Item>
        <Descriptions.Item label={t('하루 펫 XP')}>
          {t('{0} (하루 첫 미션 1회만 받아요)', R.dailyPetXp)}
        </Descriptions.Item>
      </Descriptions>
    </>
  );
}
