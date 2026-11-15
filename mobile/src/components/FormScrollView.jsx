/**
 * 입력칸이 있는 화면용 스크롤 영역.
 *
 * 최근 안드로이드는 키보드가 화면 위에 "덮어쓰는" 방식이라, 스크롤 영역은 줄어들지 않고
 * 키보드 뒤로 입력칸이 숨는다. 이 컴포넌트는
 *   1) 키보드가 떠 있는 동안 아래 여백을 키보드 높이만큼 늘려 끝까지 스크롤할 수 있게 하고,
 *   2) 안의 `TextField`가 눌리면 그 칸이 키보드 바로 위에 보이도록 화면을 올린다.
 *
 * `ScrollView`와 똑같이 쓰면 된다(`contentContainerStyle` 등 그대로 전달).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, ScrollView, View } from 'react-native';

/** 입력칸과 키보드 사이에 남길 여유(dp) */
const MARGIN = 24;

const FormScrollContext = createContext(null);

/** `TextField`가 쓴다. `FormScrollView` 밖이면 null. */
export function useFormScroll() {
  return useContext(FormScrollContext);
}

export default function FormScrollView({ children, onScroll, contentContainerStyle, ...rest }) {
  const scrollRef = useRef(null);
  const offsetY = useRef(0);
  const keyboardTop = useRef(null); // 키보드 윗면의 화면 좌표(dp), 없으면 null
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const adjust = useCallback((inputRef) => {
    const scroll = scrollRef.current;
    const input = inputRef?.current;
    if (!scroll || !input) return;
    scroll.measureInWindow((_sx, sy, _sw, sh) => {
      input.measureInWindow((_ix, iy, _iw, ih) => {
        const viewTop = sy;
        const viewBottom = Math.min(sy + sh, keyboardTop.current ?? Infinity);
        const hiddenBelow = iy + ih + MARGIN - viewBottom;
        const hiddenAbove = viewTop + MARGIN - iy;
        if (hiddenBelow > 0) {
          scroll.scrollTo({ y: offsetY.current + hiddenBelow, animated: true });
        } else if (hiddenAbove > 0) {
          scroll.scrollTo({ y: Math.max(0, offsetY.current - hiddenAbove), animated: true });
        }
      });
    });
  }, []);

  const scrollToField = useCallback(
    (inputRef) => {
      // 키보드가 이제 막 올라오는 중이면 다 올라온 뒤에, 이미 떠 있으면 바로 맞춘다.
      if (Keyboard.isVisible()) {
        setTimeout(() => adjust(inputRef), 60);
        return;
      }
      const sub = Keyboard.addListener('keyboardDidShow', () => {
        sub.remove();
        // 아래 여백이 늘어난 뒤 스크롤해야 끝까지 올라간다
        setTimeout(() => adjust(inputRef), 120);
      });
      // 키보드가 끝내 안 뜨는 경우(하드웨어 키보드)를 위한 정리
      setTimeout(() => sub.remove(), 1500);
    },
    [adjust],
  );

  const value = useMemo(() => ({ scrollToField }), [scrollToField]);

  return (
    <FormScrollContext.Provider value={value}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(event) => {
          offsetY.current = event.nativeEvent.contentOffset.y;
          onScroll?.(event);
        }}
        contentContainerStyle={contentContainerStyle}
        {...rest}>
        {children}
        {keyboardHeight > 0 && <View style={{ height: keyboardHeight }} />}
      </ScrollView>
    </FormScrollContext.Provider>
  );
}
