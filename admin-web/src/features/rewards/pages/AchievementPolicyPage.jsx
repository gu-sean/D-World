// ADM-25 Achievement conditions and rewards (append-only versions, badge image upload)
import { useMemo, useState } from 'react';
import {
  Button,
  Drawer,
  Form,
  Image,
  Input,
  InputNumber,
  Select,
  Table,
  Tag,
  Typography,
} from 'antd';
import QueryState from '../../../components/QueryState.jsx';
import ImageUpload from '../components/ImageUpload.jsx';
import { EffectiveAtItem, ErrorAlert, ReasonItem } from '../components/formBits.jsx';
import { formatTime, toIso } from '../components/helpers.js';
import {
  ACHIEVEMENT_CONDITIONS,
  MAX_POINTS,
  RARITIES,
  STREAK_TARGET_DAYS,
  VERSION_STATUS,
} from '../components/labels.js';
import {
  useAchievements,
  useCategories,
  useCreateAchievement,
  useCreateAchievementVersion,
} from '../queries.js';
import dayjs from 'dayjs';

const options = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));

/** Same rules as the server, so the admin sees them next to the field. */
function conditionError(values) {
  const { conditionType, targetCount, categoryId, rewardPoints, rewardUserXp, rewardPetXp } =
    values;
  if (conditionType === 'first_goal_completed' && targetCount !== 1) {
    return '첫 목표 완료는 목표 횟수가 1이어야 해요.';
  }
  if (conditionType === 'category_approved_mission_count' && !categoryId) {
    return '분야별 조건에는 분야를 선택해야 해요.';
  }
  if (conditionType === 'streak_milestone') {
    if (!STREAK_TARGET_DAYS.includes(targetCount))
      return '목표 횟수는 7, 30, 100 중 하나여야 해요.';
    if (rewardPoints || rewardUserXp || rewardPetXp)
      return '스트릭 마일스톤 업적은 보상이 0이어야 해요.';
  }
  return null;
}

function AchievementDrawer({ target, onClose }) {
  const [form] = Form.useForm();
  const categories = useCategories();
  const createAchievement = useCreateAchievement();
  const createVersion = useCreateAchievementVersion();
  const isNew = target.mode === 'create';
  const mutation = isNew ? createAchievement : createVersion;
  // A new achievement uses an id chosen in advance, so its badge can be uploaded before saving.
  const newOwnerId = useMemo(() => crypto.randomUUID(), []);
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
        rewardUserXp: 0,
        rewardPetXp: 0,
        status: 'draft',
        effectiveAt: dayjs().add(5, 'minute'),
      }
    : {
        ...current,
        status: target.achievement.status === 'hidden' ? 'draft' : target.achievement.status,
        effectiveAt: dayjs().add(5, 'minute'),
      };

  const onFinish = async ({ effectiveAt, reason, categoryId, ...values }) => {
    const body = {
      ...values,
      title: values.title.trim(),
      description: values.description.trim(),
      effectiveAt: toIso(effectiveAt),
      reason: reason.trim(),
      ...(conditionType === 'category_approved_mission_count' ? { categoryId } : {}),
    };
    try {
      if (isNew) await createAchievement.mutateAsync({ ...body, code: values.code.trim() });
      else await createVersion.mutateAsync({ id: ownerId, ...body });
      onClose();
    } catch {
      // the error is shown at the top of the form
    }
  };

  return (
    <Drawer
      open
      width={560}
      onClose={onClose}
      title={isNew ? '새 업적' : `새 버전 · ${target.achievement.code}`}
      destroyOnHidden
    >
      <ErrorAlert error={mutation.error} />
      <Form
        form={form}
        layout="vertical"
        initialValues={initial}
        onFinish={onFinish}
        onValuesChange={() => mutation.reset()}
      >
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
          name="title"
          label="이름"
          rules={[
            { required: true, whitespace: true, message: '이름을 입력해 주세요.' },
            { max: 160 },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="description"
          label="설명"
          rules={[
            { required: true, whitespace: true, message: '설명을 입력해 주세요.' },
            { max: 2000 },
          ]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="rarity" label="희귀도">
          <Select options={options(RARITIES)} />
        </Form.Item>
        <Form.Item name="conditionType" label="달성 조건">
          <Select options={options(ACHIEVEMENT_CONDITIONS)} />
        </Form.Item>
        <Form.Item
          name="targetCount"
          label="목표 횟수"
          dependencies={[
            'conditionType',
            'categoryId',
            'rewardPoints',
            'rewardUserXp',
            'rewardPetXp',
          ]}
          rules={[
            { required: true, message: '목표 횟수를 입력해 주세요.' },
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
            label="분야"
            rules={[{ required: true, message: '분야를 선택해 주세요.' }]}
          >
            <Select
              options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
        )}
        {[
          ['rewardPoints', '보상 포인트'],
          ['rewardUserXp', '보상 사용자 XP'],
          ['rewardPetXp', '보상 펫 XP'],
        ].map(([name, label]) => (
          <Form.Item
            key={name}
            name={name}
            label={label}
            rules={[{ required: true, message: `${label}를 입력해 주세요.` }]}
          >
            <InputNumber min={0} max={MAX_POINTS} precision={0} />
          </Form.Item>
        ))}
        <Form.Item
          name="badgeAssetId"
          label="배지 이미지"
          rules={[{ required: true, message: '배지 이미지를 올려 주세요.' }]}
        >
          <ImageUpload assetKind="badge" ownerId={ownerId} previewUrl={current?.badgeImageUrl} />
        </Form.Item>
        <Form.Item
          name="status"
          label="공개 상태"
          extra="공개로 저장하면 과거 활동도 소급해서 평가해요."
        >
          <Select
            options={[
              { value: 'draft', label: VERSION_STATUS.draft },
              { value: 'public', label: VERSION_STATUS.public },
            ]}
          />
        </Form.Item>
        <EffectiveAtItem required />
        <ReasonItem />
        <Button type="primary" htmlType="submit" loading={mutation.isPending}>
          저장
        </Button>
      </Form>
    </Drawer>
  );
}

export default function AchievementPolicyPage() {
  const list = useAchievements();
  const [target, setTarget] = useState(null);
  const items = list.data ?? [];

  const versionColumns = [
    { title: '버전', dataIndex: 'versionNo', render: (v) => `v${v}` },
    { title: '이름', dataIndex: 'title' },
    {
      title: '조건',
      render: (_, v) => `${ACHIEVEMENT_CONDITIONS[v.conditionType]} · ${v.targetCount}`,
    },
    {
      title: '보상',
      render: (_, v) => `${v.rewardPoints}P / 사용자 ${v.rewardUserXp}XP / 펫 ${v.rewardPetXp}XP`,
    },
    { title: '시행 시각', dataIndex: 'effectiveAt', render: formatTime },
  ];

  const columns = [
    {
      title: '배지',
      width: 72,
      render: (_, row) => {
        const cur =
          row.versions.find((v) => v.versionNo === row.currentVersionNo) ?? row.versions.at(-1);
        return cur?.badgeImageUrl ? <Image src={cur.badgeImageUrl} width={40} /> : null;
      },
    },
    { title: '코드', dataIndex: 'code' },
    {
      title: '현재 이름',
      render: (_, row) =>
        row.versions.find((v) => v.versionNo === row.currentVersionNo)?.title ?? '(시행 전)',
    },
    { title: '현재 버전', dataIndex: 'currentVersionNo', render: (v) => (v ? `v${v}` : '-') },
    {
      title: '상태',
      dataIndex: 'status',
      render: (s) => (
        <Tag color={s === 'public' ? 'green' : undefined}>{VERSION_STATUS[s] ?? s}</Tag>
      ),
    },
    {
      title: '',
      render: (_, row) => (
        <Button
          disabled={row.status === 'hidden'}
          onClick={() => setTarget({ mode: 'version', achievement: row })}
        >
          새 버전
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          업적 조건과 보상
        </Typography.Title>
        <Button type="primary" onClick={() => setTarget({ mode: 'create' })}>
          새 업적
        </Button>
      </div>
      <QueryState
        loading={list.isLoading}
        error={list.error}
        empty={items.length === 0}
        onRetry={list.refetch}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          pagination={false}
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
        />
      </QueryState>
      {target && <AchievementDrawer target={target} onClose={() => setTarget(null)} />}
    </div>
  );
}
