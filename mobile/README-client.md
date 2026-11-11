# mobile 기능 모듈 (이연수 파트)

D-World 앱의 **기능 모듈**이다. 화면은 최정훈이 만들고, 화면이 부르는 것은 전부 여기 있다
([docs/parts/mobile-client.md](../docs/parts/mobile-client.md), [docs/tasks/mobile-client.md](../docs/tasks/mobile-client.md)).

## 1. 이 폴더에서 내 것 / 남의 것

| 경로 | 누구 |
|---|---|
| `src/client/**` · `src/setup/**` · `client-tests/**` · `scripts/check-client.js` | **이연수** |
| `index.js` · `App.jsx` · `src/screens/` · `src/navigation/` · `src/components/` · `android/` | 최정훈 |
| `package.json` · `.env.example` | 공용 — 아래 "합치기" 참고 |

## 2. 합치기 (최정훈의 RN 프로젝트에 올릴 때)

이 폴더는 MU-01(RN 프로젝트 생성)이 끝나기 전에 쓴 것이라 `package.json`이 따로 있다.
RN 프로젝트가 생기면 **덮어쓰지 말고** 아래 세 가지만 옮긴다.

1. `src/client/`, `src/setup/`, `client-tests/`, `scripts/check-client.js` 폴더째 복사
2. `package.json`의 `scripts` 두 줄과 `dependencies` 목록을 기존 `package.json`에 합치기
   ```json
   "test:client": "node --test --import ./client-tests/helpers/register.js \"client-tests/**/*.test.js\"",
   "check:client": "node --experimental-vm-modules --no-warnings scripts/check-client.js"
   ```
3. `index.js` 첫 줄에 `import './src/setup/polyfills';` 넣기 (uuid가 이걸 필요로 한다)

그리고 `App.jsx`에서 화면 트리를 감싼다:

```jsx
import { ClientProvider } from './src/client';

export default function App() {
  return (
    <ClientProvider>
      <Navigation />
    </ClientProvider>
  );
}
```

네이티브 설정(권한·gradle)은 [docs/parts/mobile-ui.md](../docs/parts/mobile-ui.md) §8 표에 있다.

> `package.json`의 라이브러리 버전은 12 §1(RN 0.86.x · Expo SDK 57) 기준으로 적은 범위다.
> MU-01에서 실제로 깔리는 버전으로 최정훈이 확정한다.

## 3. 실행·확인

```bash
npm run test:client    # node --test, RN 없이 돈다 (137개)
npm run check:client   # src/client에 JSX·UI import가 없는지 + 문법 검사
```

Node 22.12 이상이 필요하다 (`.js`에 ESM 문법을 쓰고 `node --test`의 glob을 쓴다).

백엔드 없이 화면을 만들려면 `.env`에 `USE_MOCK_API=true`를 넣는다.
`src/client/mock/`이 08의 모든 GET과 주요 POST에 07 모양으로 답하고,
판정은 제출 6초 뒤에 붙는다 (목표값 끝자리 3 → 거절, 4 → 검수 필요, 그 외 승인 — 12 §9).

개발 계정은 `01000000001` / `devuser1234`, 인증번호는 `000000`이다.

## 4. 화면이 쓰는 것

`src/client/index.js`가 내보내는 것**만** 쓴다. 목록과 설명은 parts/mobile-client.md §4.2 표와 같고,
`client-tests/publicApi.test.js`가 둘이 어긋나지 않는지 지킨다.

```js
import { useHome, useCameraVerification, format, labels, validators } from '../client';

const home = useHome();            // A29 — data, isLoading, error, refetch
const v = useCameraVerification(missionId);
v.start();                         // VERIFY-03 "인증 시작"
```

필요한 기능이 목록에 없으면 **이슈로 요청**한다 (01 §2 공용 파일 규칙).

## 5. 설계 문서와 다르게 한 곳

작업하면서 문서를 그대로 따르기 어려웠거나, 문서가 정하지 않은 자리를 메운 곳이다.
팀 검토 후 문서를 고치거나 코드를 고친다.

| 곳 | 문서 | 코드 | 이유 |
|---|---|---|---|
| 배열 쿼리 | parts/mobile-client §3.1 1번 "배열은 같은 키 반복" | 쉼표로 이음 (`?status=a,b`) | 05 §6과 08 A21·A30이 쉼표를 쓴다. 백엔드가 받는 쪽을 따랐다 — **parts 문서를 고치는 게 맞다** |
| `queries/mutation.js` | §2 폴더 목록에 없음 | 추가 | 모든 변경 훅이 쓰는 멱등 키·무효화 공통 틀. 같은 코드를 30번 적지 않으려고 |
| 앱 시작 시 네트워크 오류 | §3.4는 "성공 → signedIn", "갱신 실패 → signedOut"까지만 정함 | 네트워크 오류면 토큰을 그대로 두고 `signedIn` | 오프라인이라고 30일짜리 리프레시 토큰을 버리면 손해만 크다 |
| 가짜 서버 판정 | MC-05 "끝자리 3이면 rejected" | 3 → 거절, 4 → 검수 필요 | 12 §9·10 §7의 개발용 AI 드라이버(`fixed`)와 같게 맞췄다. S5(끝자리 4) 흐름을 가짜 서버로도 볼 수 있다 |
| `formatTime` | 모양을 정하지 않음 | `오후 2:15` | `formatDate`(`11월 4일 (수)`)와 같은 결로 골랐다 |
| `labels.js` | §9 "04 §5 표의 모든 상태값에 문구가 있음" | 04 §5에 한국어가 없는 묶음은 빼 둠 | `media_kind`·`upload_status`·포인트 `source_type`·`push_status`·`run_type`·`condition_type`은 표에 문구가 없다. 지어내지 않았다 — 화면에 필요하면 04를 먼저 고친다 |
| 기기 모델 | §8 `device.model` | `Platform.constants.Model` | 기기 정보 라이브러리를 더 넣지 않아도 Android에서 모델·OS 버전을 읽을 수 있다 |
