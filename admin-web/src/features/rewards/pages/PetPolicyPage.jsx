// ADM-26 Pet species (append-only versions, 3 stages with images) and growth rules (read-only)
import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Drawer,
  Form,
  Image,
  Input,
  InputNumber,
  Select,
  Table,
  Tabs,
  Typography,
} from 'antd';
import { newId } from '../../../api/ids.js';
import dayjs from 'dayjs';
import { DateText } from '../../../components/DateText.jsx';
import { ImageUploadField } from '../../../components/ImageUploadField.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { StatePanel } from '../../../components/StatePanel.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { EffectiveAtItem } from '../components/EffectiveAtItem.jsx';
import { GrowthRules } from '../components/GameRulesCards.jsx';
import { STAGE_MIN_XP } from '../components/gameRules.js';
import { toIso } from '../components/helpers.js';
import {
  conditionOptions,
  optionsOf,
  stageText,
  STREAK_TARGET_DAYS,
  UNLOCK_CONDITIONS,
} from '../components/labels.js';
import { useConfirmedChange } from '../components/useConfirmedChange.jsx';
import {
  useAchievements,
  useCategories,
  useCreatePetSpecies,
  useCreatePetSpeciesVersion,
  usePetSpecies,
} from '../queries.js';
import { t } from '../../../i18n/index.js';

const compact = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );

/** Stage rules of the server, shown next to the stage fields. */
function stagesError(stages = []) {
  const [first, second, third] = stages;
  if (!first || !second || !third) return null;
  if (first.minTotalXp !== 0) return t('1단계 필요 XP는 0이어야 해요.');
  if (!(second.minTotalXp > 0) || !(third.minTotalXp > second.minTotalXp)) {
    return t('필요 XP는 단계가 오를수록 커야 해요.');
  }
  const ids = new Set(stages.map((s) => s.imageAssetId));
  if (ids.size !== 3 && stages.every((s) => s.imageAssetId))
    return t('단계마다 다른 이미지를 써야 해요.');
  return null;
}

function SpeciesDrawer({ target, onClose }) {
  const [form] = Form.useForm();
  const categories = useCategories();
  const achievements = useAchievements();
  const createSpecies = useCreatePetSpecies();
  const createVersion = useCreatePetSpeciesVersion();
  const isNew = target.mode === 'create';
  const [ask, modal] = useConfirmedChange();
  const newOwnerId = useMemo(() => newId(), []);
  const ownerId = isNew ? newOwnerId : target.species.id;
  const current = target.species?.versions.find(
    (v) => v.versionNo === target.species.currentVersionNo,
  );
  const unlockType = Form.useWatch('unlockConditionType', form);

  // 단계별 필요 XP는 앱 규칙으로 고정한다(알 0, 아기 90, 성체 450). 예전 버전의 값(50/200 등)은 새 버전에서 바꾼다
  const stageDefaults = [1, 2, 3].map((stageNo) => ({
    stageNo,
    minTotalXp: STAGE_MIN_XP[stageNo],
    bonusBasisPoints: 0,
  }));
  const initial = isNew
    ? {
        unlockConditionType: 'none',
        hatchMissionCount: 0,
        status: 'draft',
        stages: stageDefaults,
        effectiveAt: dayjs().add(5, 'minute'),
      }
    : {
        ...current,
        stages: current.stages.map((stage) => ({
          ...stage,
          minTotalXp: STAGE_MIN_XP[stage.stageNo],
        })),
        status: target.species.status === 'hidden' ? 'draft' : target.species.status,
        effectiveAt: dayjs().add(5, 'minute'),
      };

  const onFinish = ({ effectiveAt, code, ...values }) => {
    const needs = {
      count: [
        'approved_mission_count',
        'category_approved_mission_count',
        'streak_milestone',
      ].includes(unlockType),
      category: unlockType === 'category_approved_mission_count',
      achievement: unlockType === 'achievement_earned',
    };
    const body = compact({
      name: values.name.trim(),
      description: values.description?.trim(),
      personality: values.personality?.trim(),
      worldText: values.worldText?.trim(),
      // 펫 분야는 없앴다(022): 분야를 보내지 않는다
      unlockConditionType: unlockType,
      unlockTargetCount: needs.count ? values.unlockTargetCount : undefined,
      unlockCategoryCode: needs.category ? values.unlockCategoryCode : undefined,
      unlockAchievementId: needs.achievement ? values.unlockAchievementId : undefined,
      // 부화 조건은 모든 펫이 '세부 미션 3개'로 같다(022)
      hatchMissionCount: 3,
      status: values.status,
      effectiveAt: toIso(effectiveAt),
    });
    body.stages = values.stages.map(({ stageNo, minTotalXp, bonusBasisPoints, imageAssetId }) => ({
      stageNo,
      minTotalXp,
      bonusBasisPoints,
      imageAssetId,
    }));
    ask({
      title: isNew ? t('새 펫 종류를 저장할까요?') : t('새 버전을 저장할까요?'),
      summary: t('{0} · 해금 조건 {1}', body.name, UNLOCK_CONDITIONS[body.unlockConditionType]),
      run: ({ reason, idempotencyKey }) =>
        isNew
          ? createSpecies.mutateAsync({
              payload: { ...body, code: code.trim(), reason },
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
      width={640}
      onClose={onClose}
      title={isNew ? t('새 펫 종류') : t('새 버전 · {0}', target.species.code)}
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
          name="name"
          label={t('이름')}
          rules={[
            { required: true, whitespace: true, message: t('이름을 입력해 주세요.') },
            { max: 80 },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="description" label={t('설명')} rules={[{ max: 2000 }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="personality" label={t('성격')} rules={[{ max: 2000 }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="worldText" label={t('세계관')} rules={[{ max: 4000 }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="unlockConditionType" label={t('해금 조건')}>
          <Select
            options={conditionOptions(UNLOCK_CONDITIONS).filter(
              (o) => o.value !== 'category_approved_mission_count',
            )}
          />
        </Form.Item>
        {['approved_mission_count', 'category_approved_mission_count', 'streak_milestone'].includes(
          unlockType,
        ) && (
          <Form.Item
            name="unlockTargetCount"
            label={t('해금 목표 횟수')}
            rules={[
              { required: true, message: t('목표 횟수를 입력해 주세요.') },
              () => ({
                validator: (_, v) =>
                  unlockType !== 'streak_milestone' || STREAK_TARGET_DAYS.includes(v)
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('7, 30, 100 중 하나여야 해요.'))),
              }),
            ]}
          >
            <InputNumber min={1} max={1_000_000} precision={0} />
          </Form.Item>
        )}
        {unlockType === 'category_approved_mission_count' && (
          <Form.Item
            name="unlockCategoryCode"
            label={t('해금 분야')}
            rules={[{ required: true, message: t('분야를 선택해 주세요.') }]}
          >
            <Select
              options={(categories.data ?? []).map((c) => ({ value: c.code, label: c.name }))}
            />
          </Form.Item>
        )}
        {unlockType === 'achievement_earned' && (
          <Form.Item
            name="unlockAchievementId"
            label={t('해금 업적')}
            rules={[{ required: true, message: t('업적을 선택해 주세요.') }]}
          >
            <Select
              options={(achievements.data ?? []).map((a) => ({ value: a.id, label: a.code }))}
            />
          </Form.Item>
        )}
        <Typography.Paragraph type="secondary">
          {t(
            '성장 규칙(모든 펫 공통): 세부 미션 3개를 완료하면 알에서 부화하고, 사용자가 경험치를 450 먹이면 성체가 돼요.',
          )}
        </Typography.Paragraph>

        <Typography.Title level={5}>{t('성장 단계')}</Typography.Title>
        <Form.Item noStyle shouldUpdate>
          {({ getFieldValue }) => {
            const message = stagesError(getFieldValue('stages'));
            return message ? (
              <Typography.Text type="danger" style={{ display: 'block', marginBottom: 8 }}>
                {message}
              </Typography.Text>
            ) : null;
          }}
        </Form.Item>
        <Form.List name="stages">
          {(fields) =>
            fields.map((field, index) => (
              <Card
                key={field.key}
                size="small"
                title={t('{0}단계 · {1}', index + 1, stageText(index + 1))}
                style={{ marginBottom: 12 }}
              >
                <Form.Item name={[field.name, 'stageNo']} hidden>
                  <InputNumber />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'minTotalXp']}
                  label={t('필요 누적 XP')}
                  rules={[{ required: true, message: t('필요 XP를 입력해 주세요.') }]}
                >
                  <InputNumber min={0} precision={0} disabled />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'bonusBasisPoints']}
                  label={t('보너스 (1/100 %)')}
                  extra="0 ~ 2000"
                  rules={[{ required: true, message: t('보너스를 입력해 주세요.') }]}
                >
                  <InputNumber min={0} max={2000} precision={0} />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'imageAssetId']}
                  label={t('이미지')}
                  rules={[{ required: true, message: t('이미지를 올려 주세요.') }]}
                >
                  <ImageUploadField assetKind="pet_stage" ownerId={ownerId} />
                </Form.Item>
              </Card>
            ))
          }
        </Form.List>

        <Form.Item name="status" label={t('공개 상태')}>
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

function SpeciesTab() {
  const list = usePetSpecies();
  const [target, setTarget] = useState(null);

  const versionColumns = [
    { title: t('버전'), dataIndex: 'versionNo', render: (v) => `v${v}` },
    { title: t('이름'), dataIndex: 'name' },
    { title: t('해금 조건'), render: (_, v) => UNLOCK_CONDITIONS[v.unlockConditionType] },
    {
      title: t('단계'),
      render: (_, v) => (
        <Image.PreviewGroup>
          {v.stages.map((s) =>
            s.imageUrl ? (
              <Image key={s.stageNo} src={s.imageUrl} width={32} style={{ marginRight: 4 }} />
            ) : null,
          )}
        </Image.PreviewGroup>
      ),
    },
    {
      title: t('시행 시각'),
      dataIndex: 'effectiveAt',
      render: (value) => <DateText value={value} />,
    },
  ];

  return (
    <>
      <div style={{ textAlign: 'right', marginBottom: 16 }}>
        <Button type="primary" onClick={() => setTarget({ mode: 'create' })}>
          {t('새 펫 종류')}
        </Button>
      </div>
      <QueryBoundary query={list}>
        {(items) =>
          items.length === 0 ? (
            <StatePanel type="empty" />
          ) : (
            <Table
              rowKey="id"
              pagination={false}
              dataSource={items}
              expandable={{
                expandedRowRender: (row) => (
                  <Table
                    rowKey="versionNo"
                    size="small"
                    pagination={false}
                    columns={versionColumns}
                    dataSource={row.versions}
                  />
                ),
              }}
              columns={[
                { title: t('코드'), dataIndex: 'code' },
                {
                  title: t('현재 이름'),
                  render: (_, row) =>
                    row.versions.find((v) => v.versionNo === row.currentVersionNo)?.name ??
                    t('(시행 전)'),
                },
                {
                  title: t('현재 버전'),
                  dataIndex: 'currentVersionNo',
                  render: (v) => (v ? `v${v}` : '-'),
                },
                {
                  title: t('상태'),
                  dataIndex: 'status',
                  render: (value) => (
                    <StatusTag kind="missionDefinitionPublicationStatus" value={value} />
                  ),
                },
                {
                  title: '',
                  render: (_, row) => (
                    <Button
                      disabled={row.status === 'hidden'}
                      onClick={() => setTarget({ mode: 'version', species: row })}
                    >
                      {t('새 버전')}
                    </Button>
                  ),
                },
              ]}
            />
          )
        }
      </QueryBoundary>
      {target && <SpeciesDrawer target={target} onClose={() => setTarget(null)} />}
    </>
  );
}

export default function PetPolicyPage() {
  return (
    <div>
      <Typography.Title level={3}>{t('펫과 진화 단계')}</Typography.Title>
      <Typography.Paragraph type="secondary">
        {t('정책은 수정하지 않고 새 버전을 추가해요. 이미 키우는 펫은 자기 버전을 유지해요.')}
      </Typography.Paragraph>
      <Tabs
        items={[
          { key: 'species', label: t('펫 종류'), children: <SpeciesTab /> },
          { key: 'growth', label: t('성장 단계 기준'), children: <GrowthRules /> },
        ]}
      />
    </div>
  );
}
