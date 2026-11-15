/**
 * 펫 그림.
 *
 * 서버가 준 단계별 이미지를 동그랗게 보여 준다. 이미지가 올 때까지는 발바닥(알은 점)
 * 아이콘을 보여 주고, 주소가 없거나 불러오기에 실패해도 그대로 둔다 — 빈 동그라미가
 * 보이지 않게 하기 위해서다.
 *
 * animated=false이면 움직이는 GIF 대신 정지 썸네일(stillUrl)을 쓴다. 목록처럼 한 화면에
 * 여러 마리가 보이는 곳은 정지로, 펫 방·상세·진화처럼 한두 마리만 크게 보이는 곳은
 * 움직이게 한다.
 *
 * @param {{pet?: {imageUrl?: string|null, stillUrl?: string|null, stageCode?: string}|null, size?: number, animated?: boolean}} props
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import Icon from './Icon';
import { colors, radius } from '../theme';

export default function PetAvatar({ pet, size = 72, animated = true }) {
  const uri = animated ? pet?.imageUrl : (pet?.stillUrl ?? pet?.imageUrl);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [uri]);

  const showImage = !!uri && !failed;
  const box = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.wrap, box]}>
      {(!showImage || !loaded) && (
        <Icon
          name={pet?.stageCode === 'egg' ? 'dot' : 'paw'}
          size={size * 0.5}
          color={colors.textSub}
        />
      )}
      {showImage && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
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
