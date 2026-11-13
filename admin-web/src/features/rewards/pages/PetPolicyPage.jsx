// ADM-26 Pet species (append-only versions, 3 stages with images) and pet level thresholds
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
  Tag,
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
import { pickCurrent, toIso } from '../components/helpers.js';
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
  useCreatePetLevels,
  useCreatePetSpecies,
  useCreatePetSpeciesVersion,
  usePetLevels,
  usePetSpecies,
} from '../queries.js';

const compact = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );

/** Stage rules of the server, shown next to the stage fields. */
function stagesError(stages = []) {
  const [first, second, third] = stages;
  if (!first || !second || !third) return null;
  if (first.minTotalXp !== 0) return '1단계 필요 XP는 0이어야 해요.';
  if (!(second.minTotalXp > 0) || !(third.minTotalXp > second.minTotalXp)) {
    return '필요 XP는 단계가 오를수록 커야 해요.';
  }
  const ids = new Set(stages.map((s) => s.imageAssetId));
  if (ids.size !== 3 && stages.every((s) => s.imageAssetId))
    return '단계마다 다른 이미지를 써야 해요.';
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

  const stageDefaults = [1, 2, 3].map((stageNo) => ({
    stageNo,
    minTotalXp: stageNo === 1 ? 0 : undefined,
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
      categoryId: values.categoryId,
      unlockConditionType: unlockType,
      unlockTargetCount: needs.count ? values.unlockTargetCount : undefined,
      unlockCategoryCode: needs.category ? values.unlockCategoryCode : undefined,
      unlockAchievementId: needs.achievement ? values.unlockAchievementId : undefined,
      hatchMissionCount: values.hatchMissionCount,
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
      title: isNew ? '새 펫 종류를 저장할까요?' : '새 버전을 저장할까요?',
      summary: `${body.name} · 해금 조건 ${UNLOCK_CONDITIONS[body.unlockConditionType]}`,
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

  const categoryOptions = (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  return (
    <Drawer
      open
      width={640}
      onClose={onClose}
      title={isNew ? '새 펫 종류' : `새 버전 · ${target.species.code}`}
      destroyOnHidden
    >
      {modal}
      <Form form={form} layout="vertical" initialValues={initial} onFinish={onFinish}>
        {isNew && (
          <Form.Item
            name="code"
            label="코드"
            rules={[
              { required: true, message: '코드를 입력해 주세요.' },
              {
                pattern: /^[a-z][a-z0-9_]{0,79}$/,
                message: '소문자로 시작하는 소문자·숫자·밑줄만 가능해요.',
              },
            ]}
          >
            <Input />
          </Form.Item>
        )}
        <Form.Item
          name="name"
          label="이름"
          rules={[
            { required: true, whitespace: true, message: '이름을 입력해 주세요.' },
            { max: 80 },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="description" label="설명" rules={[{ max: 2000 }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="personality" label="성격" rules={[{ max: 2000 }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="worldText" label="세계관" rules={[{ max: 4000 }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item
          name="categoryId"
          label="분야"
          rules={[{ required: true, message: '분야를 선택해 주세요.' }]}
        >
          <Select options={categoryOptions} />
        </Form.Item>
        <Form.Item name="unlockConditionType" label="해금 조건">
          <Select options={conditionOptions(UNLOCK_CONDITIONS)} />
        </Form.Item>
        {['approved_mission_count', 'category_approved_mission_count', 'streak_milestone'].includes(
          unlockType,
        ) && (
          <Form.Item
            name="unlockTargetCount"
            label="해금 목표 횟수"
            rules={[
              { required: true, message: '목표 횟수를 입력해 주세요.' },
              () => ({
                validator: (_, v) =>
                  unlockType !== 'streak_milestone' || STREAK_TARGET_DAYS.includes(v)
                    ? Promise.resolve()
                    : Promise.reject(new Error('7, 30, 100 중 하나여야 해요.')),
              }),
            ]}
          >
            <InputNumber min={1} max={1_000_000} precision={0} />
          </Form.Item>
        )}
        {unlockType === 'category_approved_mission_count' && (
          <Form.Item
            name="unlockCategoryCode"
            label="해금 분야"
            rules={[{ required: true, message: '분야를 선택해 주세요.' }]}
          >
            <Select
              options={(categories.data ?? []).map((c) => ({ value: c.code, label: c.name }))}
            />
          </Form.Item>
        )}
        {unlockType === 'achievement_earned' && (
          <Form.Item
            name="unlockAchievementId"
            label="해금 업적"
            rules={[{ required: true, message: '업적을 선택해 주세요.' }]}
          >
            <Select
              options={(achievements.data ?? []).map((a) => ({ value: a.id, label: a.code }))}
            />
          </Form.Item>
        )}
        <Form.Item
          name="hatchMissionCount"
          label="부화 필요 미션 수"
          rules={[{ required: true, message: '미션 수를 입력해 주세요.' }]}
        >
          <InputNumber min={0} max={1_000_000} precision={0} />
        </Form.Item>

        <Typography.Title level={5}>성장 단계</Typography.Title>
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
                title={`${index + 1}단계 · ${stageText(index + 1)}`}
                style={{ marginBottom: 12 }}
              >
                <Form.Item name={[field.name, 'stageNo']} hidden>
                  <InputNumber />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'minTotalXp']}
                  label="필요 누적 XP"
                  rules={[{ required: true, message: '필요 XP를 입력해 주세요.' }]}
                >
                  <InputNumber min={0} precision={0} disabled={index === 0} />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'bonusBasisPoints']}
                  label="보너스 (1/100 %)"
                  extra="0 ~ 2000"
                  rules={[{ required: true, message: '보너스를 입력해 주세요.' }]}
                >
                  <InputNumber min={0} max={2000} precision={0} />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'imageAssetId']}
                  label="이미지"
                  rules={[{ required: true, message: '이미지를 올려 주세요.' }]}
                >
                  <ImageUploadField assetKind="pet_stage" ownerId={ownerId} />
                </Form.Item>
              </Card>
            ))
          }
        </Form.List>

        <Form.Item name="status" label="공개 상태">
          <Select options={optionsOf('missionDefinitionPublicationStatus', ['draft', 'public'])} />
        </Form.Item>
        <EffectiveAtItem required />
        <Button type="primary" htmlType="submit">
          저장
        </Button>
      </Form>
    </Drawer>
  );
}

function SpeciesTab() {
  const list = usePetSpecies();
  const [target, setTarget] = useState(null);

  const versionColumns = [
    { title: '버전', dataIndex: 'versionNo', render: (v) => `v${v}` },
    { title: '이름', dataIndex: 'name' },
    { title: '해금 조건', render: (_, v) => UNLOCK_CONDITIONS[v.unlockConditionType] },
    { title: '부화 미션 수', dataIndex: 'hatchMissionCount', align: 'right' },
    {
      title: '단계',
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
      title: '시행 시각',
      dataIndex: 'effectiveAt',
      render: (value) => <DateText value={value} />,
    },
  ];

  return (
    <>
      <div style={{ textAlign: 'right', marginBottom: 16 }}>
        <Button type="primary" onClick={() => setTarget({ mode: 'create' })}>
          새 펫 종류
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
                { title: '코드', dataIndex: 'code' },
                {
                  title: '현재 이름',
                  render: (_, row) =>
                    row.versions.find((v) => v.versionNo === row.currentVersionNo)?.name ??
                    '(시행 전)',
                },
                {
                  title: '현재 버전',
                  dataIndex: 'currentVersionNo',
                  render: (v) => (v ? `v${v}` : '-'),
                },
                {
                  title: '상태',
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
                      새 버전
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

function LevelsTab() {
  const [form] = Form.useForm();
  const list = usePetLevels();
  const create = useCreatePetLevels();
  const [ask, modal] = useConfirmedChange();

  // POST /policies/pet-levels has no `reason` field: the modal only asks for confirmation and
  // makes the Idempotency-Key, so the reason typed there is not sent.
  const onFinish = ({ thresholds, effectiveAt }) =>
    ask({
      title: '새 레벨 기준을 저장할까요?',
      summary: `${thresholds.length}개 레벨 기준`,
      run: ({ idempotencyKey }) =>
        create.mutateAsync({
          payload: { thresholds, effectiveAt: toIso(effectiveAt) },
          idempotencyKey,
        }),
      onDone: () => form.resetFields(),
    });

  return (
    <>
      {modal}
      <QueryBoundary query={list}>
        {({ items }) => {
          const current = pickCurrent(items);
          return items.length === 0 ? (
            <StatePanel type="empty" />
          ) : (
            <Table
              rowKey="id"
              pagination={false}
              dataSource={items}
              columns={[
                { title: '버전', dataIndex: 'versionNo', render: (v) => `v${v}` },
                {
                  title: '시행 시각',
                  dataIndex: 'effectiveAt',
                  render: (value) => <DateText value={value} />,
                },
                {
                  title: '레벨별 필요 XP',
                  dataIndex: 'thresholds',
                  render: (t) =>
                    t
                      .map((x) => `Lv${x.levelNo}: ${Number(x.minTotalXp).toLocaleString()}`)
                      .join(' · '),
                },
                {
                  title: '상태',
                  render: (_, row) =>
                    row.id === current?.id ? <Tag color="green">적용 중</Tag> : <Tag>이력</Tag>,
                },
              ]}
            />
          );
        }}
      </QueryBoundary>
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        새 레벨 기준 추가
      </Typography.Title>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ thresholds: [{ levelNo: 1, minTotalXp: 0 }] }}
        style={{ maxWidth: 480 }}
        onFinish={onFinish}
      >
        <Form.List name="thresholds">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <div key={field.key} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <Form.Item
                    name={[field.name, 'levelNo']}
                    label="레벨"
                    rules={[{ required: true, message: '레벨을 입력해 주세요.' }]}
                  >
                    <InputNumber min={1} max={100} precision={0} />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'minTotalXp']}
                    label="필요 누적 XP"
                    rules={[{ required: true, message: '필요 XP를 입력해 주세요.' }]}
                  >
                    <InputNumber min={0} precision={0} />
                  </Form.Item>
                  <Button onClick={() => remove(field.name)} disabled={fields.length === 1}>
                    삭제
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => add({ levelNo: fields.length + 1 })}
                style={{ marginBottom: 16 }}
                disabled={fields.length >= 100}
              >
                레벨 추가
              </Button>
            </>
          )}
        </Form.List>
        <EffectiveAtItem />
        <Button type="primary" htmlType="submit">
          새 버전 저장
        </Button>
      </Form>
    </>
  );
}

export default function PetPolicyPage() {
  return (
    <div>
      <Typography.Title level={3}>펫과 진화 단계</Typography.Title>
      <Typography.Paragraph type="secondary">
        정책은 수정하지 않고 새 버전을 추가해요. 이미 키우는 펫은 자기 버전을 유지해요.
      </Typography.Paragraph>
      <Tabs
        items={[
          { key: 'species', label: '펫 종류', children: <SpeciesTab /> },
          { key: 'levels', label: '펫 레벨 기준', children: <LevelsTab /> },
        ]}
      />
    </div>
  );
}
