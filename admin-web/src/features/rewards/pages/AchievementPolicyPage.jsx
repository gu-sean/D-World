// ADM-25 Achievement conditions and rewards (append-only versions, badge image upload)
import { useState } from 'react';
import { Button, Image, Table } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { StatePanel } from '../../../components/StatePanel.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { ACHIEVEMENT_CONDITIONS } from '../components/labels.js';
import { useAchievements } from '../queries.js';
import { PageHeader } from '../../../components/PageHeader.jsx';
import { AchievementDrawer } from '../components/AchievementDrawer.jsx';
import { t } from '../../../i18n/index.js';

/** Same rules as the server, so the admin sees them next to the field. */
export default function AchievementPolicyPage() {
  const list = useAchievements();
  const [target, setTarget] = useState(null);

  const versionColumns = [
    { title: t('버전'), dataIndex: 'versionNo', render: (v) => `v${v}` },
    { title: t('이름'), dataIndex: 'title' },
    {
      title: t('조건'),
      render: (_, v) => `${ACHIEVEMENT_CONDITIONS[v.conditionType]} · ${v.targetCount}`,
    },
    {
      title: t('보상'),
      render: (_, v) => t('{0}P / 펫 {1}XP', v.rewardPoints, v.rewardPetXp),
    },
    {
      title: t('희귀도'),
      dataIndex: 'rarity',
      render: (value) => <StatusTag kind="achievementRarity" value={value} />,
    },
    {
      title: t('시행 시각'),
      dataIndex: 'effectiveAt',
      render: (value) => <DateText value={value} />,
    },
  ];

  const columns = [
    {
      title: t('배지'),
      width: 72,
      render: (_, row) => {
        const cur =
          row.versions.find((v) => v.versionNo === row.currentVersionNo) ?? row.versions.at(-1);
        return cur?.badgeImageUrl ? <Image src={cur.badgeImageUrl} width={40} /> : null;
      },
    },
    { title: t('코드'), dataIndex: 'code' },
    {
      title: t('현재 이름'),
      render: (_, row) =>
        row.versions.find((v) => v.versionNo === row.currentVersionNo)?.title ?? t('(시행 전)'),
    },
    { title: t('현재 버전'), dataIndex: 'currentVersionNo', render: (v) => (v ? `v${v}` : '-') },
    {
      title: t('상태'),
      dataIndex: 'status',
      render: (value) => <StatusTag kind="missionDefinitionPublicationStatus" value={value} />,
    },
    {
      title: '',
      render: (_, row) => (
        <Button
          disabled={row.status === 'hidden'}
          onClick={() => setTarget({ mode: 'version', achievement: row })}
        >
          {t('새 버전')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('업적 조건과 보상')}
        actions={
          <Button type="primary" onClick={() => setTarget({ mode: 'create' })}>
            {t('새 업적')}
          </Button>
        }
      />
      <QueryBoundary query={list}>
        {(items) =>
          items.length === 0 ? (
            <StatePanel type="empty" />
          ) : (
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
          )
        }
      </QueryBoundary>
      {target && <AchievementDrawer target={target} onClose={() => setTarget(null)} />}
    </div>
  );
}
