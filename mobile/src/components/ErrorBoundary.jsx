/**
 * 화면 그리는 중에 생긴 오류가 앱 전체를 멈추지 않게 받아 주는 바깥 울타리.
 *
 * 오류가 나면 "잠시 문제가 생겼어요" 안내와 "다시 시도"를 보여 준다.
 * "다시 시도"를 누르면 안쪽 화면들을 처음부터 다시 그린다(로그인 정보는 기기에 남아 있어 유지된다).
 *
 * 서버 통신 오류는 여기서 다루지 않는다 — 그건 `QueryState`가 맡는다.
 * 이 울타리는 코드 실수 같은 "그리기 오류"만 받는다.
 *
 * 바깥(`ClientProvider` 밖)에 둘 수 있도록 서버·내비게이션에 기대지 않고 기본 컴포넌트만 쓴다.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Button from './Button';
import Icon from './Icon';
import { colors, radius, spacing, typography } from '../theme';

export default class ErrorBoundary extends React.Component {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // 개발 중에는 원인을 볼 수 있게 남긴다. 실서비스에서는 이 자리에서 오류 수집 서비스로 보낸다.
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, info?.componentStack);
    }
  }

  retry = () => {
    this.setState((prev) => ({ failed: false, attempt: prev.attempt + 1 }));
  };

  render() {
    if (this.state.failed) {
      return (
        <View style={styles.wrap} accessibilityRole="alert">
          <View style={styles.iconCircle}>
            <Icon name="alert" size={40} color={colors.primary} />
          </View>
          <Text style={styles.title}>잠시 문제가 생겼어요</Text>
          <Text style={styles.body}>불편을 드려 죄송해요. 다시 시도하면 대부분 해결돼요.</Text>
          <View style={styles.button}>
            <Button title="다시 시도" onPress={this.retry} full />
          </View>
          <Text style={styles.hint}>계속되면 앱을 완전히 종료한 뒤 다시 열어 주세요.</Text>
        </View>
      );
    }
    // attempt를 key로 써서 다시 시도하면 안쪽을 새로 만든다
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  body: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: spacing.md },
  hint: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
});
