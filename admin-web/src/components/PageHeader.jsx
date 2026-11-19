import { Flex, Typography } from 'antd';

/**
 * The top of every page: title, a one-line description under it and the main action(s) on the right.
 * Page title 24px, description 14px secondary, 16px below. Use it instead of a bare Typography.Title.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.title
 * @param {import('react').ReactNode} [props.description] one short sentence
 * @param {import('react').ReactNode} [props.actions] buttons, shown on the right (wraps under the title when narrow)
 */
export function PageHeader({ title, description, actions }) {
  return (
    <Flex justify="space-between" align="flex-start" wrap gap={12} style={{ marginBottom: 20 }}>
      <div style={{ minWidth: 0 }}>
        <Typography.Title level={3} style={{ margin: 0, fontSize: 24, lineHeight: 1.3 }}>
          {title}
        </Typography.Title>
        {description ? (
          <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
            {description}
          </Typography.Paragraph>
        ) : null}
      </div>
      {actions ? <div style={{ flex: 'none' }}>{actions}</div> : null}
    </Flex>
  );
}
