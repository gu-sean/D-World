/**
 * 앱의 진입점.
 *
 * 폴리필을 가장 먼저 불러온다. `crypto.getRandomValues`가 깔려야 멱등 키·요청 ID를
 * 만드는 uuid가 동작하기 때문에, 다른 어떤 import보다 앞에 있어야 한다.
 * 그다음 루트 컴포넌트를 네이티브 런타임에 등록한다.
 */
import './src/setup/polyfills';

import { AppRegistry } from 'react-native';

import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
