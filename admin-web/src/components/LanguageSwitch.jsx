import { Select } from 'antd';
import { LANGUAGES, getLang, setLang } from '../i18n/index.js';

// Saves the language and reloads, because texts are resolved when modules load.
export default function LanguageSwitch() {
  return (
    <Select
      size="small"
      aria-label="Language"
      value={getLang()}
      options={LANGUAGES}
      style={{ width: 100 }}
      onChange={(next) => {
        setLang(next);
        window.location.reload();
      }}
    />
  );
}
