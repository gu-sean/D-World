import { Card } from 'antd';

/** White card that holds a list page's filters and table together (one surface, not loose pieces). */
export function ListCard({ children }) {
  return (
    <Card styles={{ body: { padding: 16 } }} style={{ borderColor: '#e8ebf2' }}>
      {children}
    </Card>
  );
}
