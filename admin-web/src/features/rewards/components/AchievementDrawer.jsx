// Drawer to add an achievement or a new version of one
import { useMemo } from 'react';
import { Button, Drawer, Form, Input, InputNumber, Select } from 'antd';
import { newId } from '../../../api/ids.js';
import { ImageUploadField } from '../../../components/ImageUploadField.jsx';
import { EffectiveAtItem } from './EffectiveAtItem.jsx';
import { toIso } from './helpers.js';
import {
  ACHIEVEMENT_CONDITIONS,
  conditionOptions,
  MAX_POINTS,
  optionsOf,
  STREAK_TARGET_DAYS,
} from './labels.js';
import { useConfirmedChange } from '../../../components/useConfirmedChange.jsx';
import { useCategories, useCreateAchievement, useCreateAchievementVersion } from '../queries.js';
import dayjs from 'dayjs';
import { t } from '../../../i18n/index.js';

/** Same rules as the server, so the admin sees them next to the field. */
function conditionError(values) {
  const { conditionType, targetCount, categoryId, rewardPoints, rewardPetXp } = values;
  if (conditionType === 'first_goal_completed' && targetCount !== 1) {
    return t('첫 목표 완료는 목표 횟수가 1이어야 해요.');
  }
  if (conditionType === 'category_approved_mission_count' && !categoryId) {
    return t('분야별 조건에는 분야를 선택해야 해요.');
  }
  if (conditionType === 'streak_milestone') {
    if (!STREAK_TARGET_DAYS.includes(targetCount))
      return t('목표 횟수는 7, 30, 100 중 하나여야 해요.');
    if (rewardPoints || rewardPetXp) return t('스트릭 마일스톤 업적은 보상이 0이어야 해요.');
  }
  return null;
}

export function AchievementDrawer({ target, onClose }) {
  const [form] = Form.useForm();
  const categories = useCategories();
  const createAchievement = useCreateAchievement();
  const createVersion = useCreateAchievementVersion();
  const isNew = target.mode === 'create';
  const [ask, modal] = useConfirmedChange();
  // A new achievement uses an id chosen in advance, so its badge can be uploaded before saving.
  const newOwnerId = useMemo(() => newId(), []);
  const ownerId = isNew ? newOwnerId : target.achievement.id;
  const current = target.achievement?.versions.find(
    (v) => v.versionNo === target.achievement.currentVersionNo,
  );
  const conditionType = Form.useWatch('conditionType', form);

  const initial = isNew
    ? {
        rarity: 'common',
        conditionType: 'approved_mission_count',
        targetCount: 1,
        rewardPoints: 0,
        rewardPetXp: 0,
        status: 'draft',
        effectiveAt: dayjs().add(5, 'minute'),
      }
    : {
        ...current,
        status: target.achievement.status === 'hidden' ? 'draft' : target.achievement.status,
        effectiveAt: dayjs().add(5, 'minute'),
      };

  const onFinish = ({ effectiveAt, categoryId, ...values }) => {
    const body = {
      ...values,
      title: values.title.trim(),
      description: values.description.trim(),
      effectiveAt: toIso(effectiveAt),
      ...(conditionType === 'category_approved_mission_count' ? { categoryId } : {}),
    };
    ask({
      title: isNew ? t('새 업적을 저장할까요?') : t('새 버전을 저장할까요?'),
      summary: `${body.title} · ${ACHIEVEMENT_CONDITIONS[body.conditionType]} ${body.targetCount}`,
      run: ({ reason, idempotencyKey }) =>
        isNew
          ? createAchievement.mutateAsync({
              payload: { ...body, code: values.code.trim(), reason },
              idempotencyKey,
            })
          : createVersion.mutateAsync({
              payload: { id: ownerId, ...body, reason },
              idempotencyKey,
            }),
      onDone: onClose,
    });
  };

  return (
    <Drawer
      open
      size={560}
      onClose={onClose}
      title={isNew ? t('새 업적') : t('새 버전 · {0}', target.achievement.code)}
      destroyOnHidden
    >
      {modal}
      <Form form={form} layout="vertical" initialValues={initial} onFinish={onFinish}>
        {isNew && (
          <Form.Item
            name="code"
            label={t('코드')}
            rules={[
              { required: true, message: t('코드를 입력해 주세요.') },
              {
                pattern: /^[a-z][a-z0-9_]{0,79}$/,
                message: t('소문자로 시작하는 소문자·숫자·밑줄만 가능해요.'),
              },
            ]}
          >
            <Input />
          </Form.Item>
        )}
        <Form.Item
          name="title"
          label={t('이름')}
          rules={[
            { required: true, whitespace: true, message: t('이름을 입력해 주세요.') },
            { max: 160 },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="description"
          label={t('설명')}
          rules={[
            { required: true, whitespace: true, message: t('설명을 입력해 주세요.') },
            { max: 2000 },
          ]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="rarity" label={t('희귀도')}>
          <Select options={optionsOf('achievementRarity')} />
        </Form.Item>
        <Form.Item name="conditionType" label={t('달성 조건')}>
          <Select options={conditionOptions(ACHIEVEMENT_CONDITIONS)} />
        </Form.Item>
        <Form.Item
          name="targetCount"
          label={t('목표 횟수')}
          dependencies={['conditionType', 'categoryId', 'rewardPoints', 'rewardPetXp']}
          rules={[
            { required: true, message: t('목표 횟수를 입력해 주세요.') },
            ({ getFieldsValue }) => ({
              validator: () => {
                const message = conditionError(getFieldsValue());
                return message ? Promise.reject(new Error(message)) : Promise.resolve();
              },
            }),
          ]}
        >
          <InputNumber min={1} max={1_000_000} precision={0} />
        </Form.Item>
        {conditionType === 'category_approved_mission_count' && (
          <Form.Item
            name="categoryId"
            label={t('분야')}
            rules={[{ required: true, message: t('분야를 선택해 주세요.') }]}
          >
            <Select
              options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
        )}
        {[
          ['rewardPoints', t('보상 포인트')],
          ['rewardPetXp', t('보상 펫 XP')],
        ].map(([name, label]) => (
          <Form.Item
            key={name}
            name={name}
            label={label}
            rules={[{ required: true, message: t('{0}를 입력해 주세요.', label) }]}
          >
            <InputNumber min={0} max={MAX_POINTS} precision={0} />
          </Form.Item>
        ))}
        <Form.Item
          name="badgeAssetId"
          label={t('배지 이미지')}
          rules={[{ required: true, message: t('배지 이미지를 올려 주세요.') }]}
        >
          <ImageUploadField assetKind="badge" ownerId={ownerId} />
        </Form.Item>
        <Form.Item
          name="status"
          label={t('공개 상태')}
          extra={t('공개로 저장하면 과거 활동도 소급해서 평가해요.')}
        >
          <Select options={optionsOf('missionDefinitionPublicationStatus', ['draft', 'public'])} />
        </Form.Item>
        <EffectiveAtItem required />
        <Button type="primary" htmlType="submit">
          {t('저장')}
        </Button>
      </Form>
    </Drawer>
  );
}
