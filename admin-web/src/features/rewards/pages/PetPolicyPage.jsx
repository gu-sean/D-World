// ADM-26 Pet species (append-only versions, 3 stages with images) and growth rules (read-only)
import { useState } from 'react';
import { Button, Image, Table, Tabs, Typography } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { StatePanel } from '../../../components/StatePanel.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { GrowthRules } from '../components/GameRulesCards.jsx';
import { UNLOCK_CONDITIONS } from '../components/labels.js';
import { usePetSpecies } from '../queries.js';
import { SpeciesDrawer } from '../components/SpeciesDrawer.jsx';
import { t } from '../../../i18n/index.js';
import { PageHeader } from '../../../components/PageHeader.jsx';

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
      <PageHeader title={t('펫과 진화 단계')} />
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
