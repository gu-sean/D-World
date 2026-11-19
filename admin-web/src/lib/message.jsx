import { App } from 'antd';

// antd's static `message` cannot read the ConfigProvider theme (it logs a warning). This holds the
// context-aware instance from `App.useApp()` and exposes the same call style (`message.success(...)`),
// so pages keep writing `message.success(t('처리했어요'))`.
let api = null;

/** Render once inside <App>; it hands the context-aware message instance to `message`. */
export function MessageBridge() {
  api = App.useApp().message;
  return null;
}

const call =
  (method) =>
  (...args) =>
    api?.[method](...args);

// The file exports the bridge component and the `message` helper together on purpose (pages import
// `message` like antd's static one), so fast refresh falls back to a full reload for this file only.
// eslint-disable-next-line react-refresh/only-export-components
export const message = {
  success: call('success'),
  error: call('error'),
  warning: call('warning'),
  info: call('info'),
  loading: call('loading'),
  open: call('open'),
  destroy: call('destroy'),
};
