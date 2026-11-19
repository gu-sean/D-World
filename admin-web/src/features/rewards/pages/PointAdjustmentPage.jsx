// ADM-23 Manual point grant / recovery
import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, InputNumber, Radio, Select } from 'antd';
import { Link, useSearchParams } from 'react-router';
import { useUsers } from '../../users/queries.js';
import { useConfirmedChange } from '../../../components/useConfirmedChange.jsx';
import { MAX_POINTS } from '../components/labels.js';
import { useAdjustPoints, useMember } from '../queries.js';
import { ID_PATTERN } from '../../../api/ids.js';
import { t } from '../../../i18n/index.js';
import { PageHeader } from '../../../components/PageHeader.jsx';

/** 닉네임이나 회원 ID로 찾아 고르는 칸. 회원 ID를 그대로 붙여 넣어도 된다. */
function MemberSelect({ value, onChange }) {
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const found = useUsers({ query: debounced || undefined, page: 1, size: 8 });
  const options = (found.data?.items ?? []).map((user) => ({
    value: user.id,
    label: `${user.nickname ?? t('(닉네임 없음)')} · ${user.id}`,
  }));
  // keep the chosen member visible even when the list no longer contains it
  if (value && !options.some((option) => option.value === value)) {
    options.unshift({ value, label: value });
  }
  return (
    <Select
      showSearch
      allowClear
      value={value || undefined}
      onChange={(next) => onChange?.(next ?? '')}
      onSearch={setText}
      filterOption={false}
      loading={found.isFetching}
      options={options}
      placeholder={t('닉네임이나 회원 ID로 찾아요')}
      notFoundContent={t('찾는 회원이 없어요.')}
    />
  );
}

const ACTION_TEXT = { manual_grant: t('지급'), manual_recovery: t('회수') };

/** 입력한 회원 ID가 누구인지 바로 아래에 보여 준다 (잘못된 회원에게 조정하지 않게). */
function MemberCheck({ query }) {
  if (!query.data && !query.isError) return null;
  if (query.isError) {
    return <Alert type="error" showIcon title={t('이 회원 ID로 가입한 회원을 찾을 수 없어요.')} />;
  }
  const user = query.data;
  return (
    <Alert
      type="info"
      showIcon
      title={t(
        '{0} · 보유 {1} P',
        user.nickname ?? t('(닉네임 없음)'),
        user.availablePoints.toLocaleString(),
      )}
    />
  );
}

export default function PointAdjustmentPage() {
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const adjust = useAdjustPoints();
  const [ask, modal] = useConfirmedChange();

  // 회원 상세의 "포인트 조정"에서 오면 회원 ID가 채워져 있다 (?userId=)
  const typedId = (Form.useWatch('userId', form) ?? '').trim();
  const member = useMember(ID_PATTERN.test(typedId) ? typedId : null);

  // The server decides the result (balance, whether a recovery is possible); nothing is
  // calculated here (docs/parts/admin-web.md §7 rule 3).
  const onFinish = ({ userId, kind, amount }) =>
    ask({
      title: t('포인트를 조정할까요?'),
      summary: `${member.data?.nickname ?? t('회원')} (${userId.trim()}) · ${ACTION_TEXT[kind]} · ${amount.toLocaleString()} P`,
      danger: kind === 'manual_recovery',
      run: ({ reason, idempotencyKey }) =>
        adjust.mutateAsync({
          payload: { userId: userId.trim(), kind, amount, reason },
          idempotencyKey,
        }),
      onDone: () => form.resetFields(),
    });

  return (
    <div style={{ maxWidth: 560 }}>
      {modal}
      <PageHeader
        title={t('포인트 수동 조정')}
        description={t(
          '수동 지급은 월 한도에 포함되지 않아요. 회수는 가용 잔액까지만 할 수 있어요.',
        )}
      />
      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ kind: 'manual_grant', userId: searchParams.get('userId') ?? undefined }}
          onFinish={onFinish}
        >
          <Form.Item
            name="userId"
            label={t('회원 ID')}
            rules={[
              { required: true, whitespace: true, message: t('회원 ID를 입력해 주세요.') },
              {
                validator: (_, v) =>
                  !v?.trim() || ID_PATTERN.test(v.trim())
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('회원 ID 형식을 확인해 주세요.'))),
              },
            ]}
          >
            <MemberSelect />
          </Form.Item>
          <div style={{ marginTop: -8, marginBottom: 16 }}>
            <MemberCheck query={member} />
          </div>
          <Form.Item name="kind" label={t('조치')}>
            <Radio.Group>
              <Radio.Button value="manual_grant">{t('지급')}</Radio.Button>
              <Radio.Button value="manual_recovery">{t('회수')}</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="amount"
            label={t('포인트')}
            rules={[{ required: true, message: t('포인트를 입력해 주세요.') }]}
          >
            <InputNumber min={1} max={MAX_POINTS} precision={0} style={{ width: 200 }} suffix="P" />
          </Form.Item>
          <Button type="primary" htmlType="submit" disabled={member.isError}>
            {t('조정하기')}
          </Button>{' '}
          <Link to={typedId ? `/rewards/points?member=${typedId}` : '/rewards/points'}>
            <Button>{t('내역 보기')}</Button>
          </Link>
        </Form>
      </Card>
    </div>
  );
}
