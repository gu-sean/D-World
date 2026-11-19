import { Flex } from 'antd';

const GAPS = { small: 8, middle: 16, large: 24 };

/** Children one under the other with an even gap, full width. `size`: small 8 / middle 16 / large 24. */
export function Stack({ size = 'middle', children }) {
  return (
    <Flex vertical gap={GAPS[size] ?? size}>
      {children}
    </Flex>
  );
}
