/**
 * 펫 그림.
 *
 * 서버가 준 단계별 이미지를 동그랗게 보여 준다. 이미지 주소가 없거나 불러오기에
 * 실패하면 발바닥 아이콘으로 대신한다 — 빈 네모가 보이지 않게 하기 위해서다.
 *
 * @param {{pet?: {imageUrl?: string|null, stageCode?: string}|null, size?: number}} props
 */
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import Icon from './Icon';
import { colors, radius } from '../theme';

export default function PetAvatar({ pet, size = 72 }) {
  const [failed, setFailed] = useState(false);
  const showImage = !!pet?.imageUrl && !failed;
  const box = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.wrap, box]}>
      {showImage ? (
        <Image
          source={{ uri: pet.imageUrl }}
          style={box}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon
          name={pet?.stageCode === 'egg' ? 'dot' : 'paw'}
          size={size * 0.5}
          color={colors.textSub}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
