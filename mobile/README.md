# D-World 모바일 앱

React Native CLI 0.86 · React 19.2 · JavaScript(JSDoc) · Android 전용 (12 §1).

설계서는 `D-World-docs-v1/docs/`를 따른다 — 화면은 `parts/mobile-ui.md`, 서버 통신은
`parts/mobile-client.md`, DTO 모양은 `07-DTO-사전.md`, 엔드포인트는 `08-API-앱.md`.

## 실행

```bash
npm install
cp .env.example .env     # API_BASE_URL을 백엔드 주소로 맞춘다
npm start                # Metro
npm run android          # 기기·에뮬레이터에 설치 (adb reverse 포함)
npm run lint
```

`.env`에는 비밀값을 넣지 않는다 — 앱에 들어간 값은 모두 공개된다고 본다.

## 폴더

| 폴더 | 무엇이 들어 있나 |
|---|---|
| `src/client/` | 서버 통신·세션·업로드·센서 — 화면이 아닌 모든 것. `.js`만 쓰고 JSX를 넣지 않는다 |
| `src/screens/` | 화면 81개. 파일 맨 위 주석에 화면 ID를 적는다 (`// MISSION-09 미션 상세`) |
| `src/components/` | 공통 컴포넌트 23개 |
| `src/navigation/` | 라우트 이름·스택·탭·알림 링크 변환 |
| `src/theme/` | 색·여백·둥글기·글자·분야 색 |
| `src/assets/` | 아이콘 경로 데이터 (react-native-svg로 그린다) |
| `src/setup/` | 앱 시작 때 한 번 하는 일 (폴리필, 프로바이더, 푸시 등록) |

### 층 구조

```
화면 (screens)
  ↓ src/client/index.js 의 공개 훅만 쓴다
훅 (client/queries)  →  API 함수 (client/api)  →  httpClient (client/http)
                     ↘  흐름 엔진 (client/flows) · 기기 래퍼 (client/device)
```

화면은 `src/client/` 안쪽 파일을 직접 import 하지 않고, 항상 `from '../../client'`로
공개 입구만 쓴다.

## 화면 규칙 (parts/mobile-ui §6)

1. 목록·상세 화면은 `QueryState`로 감싼다. 폼 제출 실패는 `ErrorBanner`로 보여 준다.
2. 요청 중인 버튼은 `loading`으로 둬서 두 번 눌리지 않게 한다.
3. 날짜·시간·숫자는 `format.*`만, 상태값 글자는 `labels.*`만 쓴다 — 화면이 '완료' 같은
   글자를 직접 적지 않는다.
4. 분야 이름은 서버가 준 값을 쓰고, 색·아이콘만 `categoryStyle`에서 찾는다.
5. 서버가 주지 않은 성공·보상·분석 결과를 지어내서 보여 주지 않는다.
6. 권한은 그 기능을 쓸 때 요청한다 (가입 때 한꺼번에 묻지 않는다).

## 설계서와 다르게 만든 곳

| 무엇 | 왜 |
|---|---|
| 공통 컴포넌트가 설계서 §5 표보다 많다 (`StatusTag`·`ListRow`·`OptionRow`·`SectionTitle`·`DateField`·`PlanStepList`·`Card`·`WeekStrip` 등) | 같은 모양이 여러 화면에 반복돼서 한 곳으로 모았다. 표에 있는 컴포넌트는 모두 그대로 있다 |
| 날짜 입력은 네이티브 달력 대신 `DateField` (직접 입력 + 하루·일주일 이동 칩) | 설계서 §8에 없는 네이티브 라이브러리를 더 넣지 않기 위해 |
| `PetAvatar`는 이미지가 없으면 `placeholder.png` 대신 발바닥 아이콘 | 아이콘은 이미 SVG로 그리고 있어서 이미지 파일을 더 넣지 않았다 |
| 약관 재동의 화면(`screens/my/ReconsentScreen.jsx`)을 하나 더 만들었다 | A13(재동의)을 부를 화면이 설계서에 없었다. 가입용 AUTH-05는 가입 흐름에 묶여 있어 로그인 뒤에는 쓸 수 없다 |
| `ios/`가 없다 | MVP는 Android만 빌드한다 (12 §1) |
| 가짜 서버(`src/client/mock/`)와 테스트를 들어냈다 | 백엔드와 통합을 시작하므로 실제 서버로만 붙는다 |

## 통합할 때 볼 곳

- 서버 주소: `.env`의 `API_BASE_URL` (끝의 `/`는 코드가 떼어 낸다)
- 오류 모양: `src/client/http/AppError.js` — 05 §2.2의 `{error: {code, message, details}}`
- 상태값 글자: `src/client/labels.js` — 04 §5 열거형 전부
- 알림 링크: `src/client/links.js` + `src/navigation/linking.js` — 07 §17 표
