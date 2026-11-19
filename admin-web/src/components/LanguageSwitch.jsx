import { Select } from 'antd';
import { LANGUAGES, getLang, setLang } from '../i18n/index.js';
import koreaFlag from '../assets/flags/kr.png';
import usFlag from '../assets/flags/us.png';

// Flag emoji do not render on Windows, so the flags are small images.
const FLAG_IMAGES = { ko: koreaFlag, en: usFlag };

const withFlag = (option) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <img
      src={FLAG_IMAGES[option.value]}
      alt=""
      width={21}
      height={14}
      style={{ borderRadius: 2, boxShadow: '0 0 0 1px rgba(0,0,0,.18)', flex: 'none' }}
    />
    {option.label}
  </span>
);

// Saves the language and reloads, because texts are resolved when modules load.
export default function LanguageSwitch() {
  return (
    <Select
      size="small"
      aria-label="Language"
      value={getLang()}
      options={LANGUAGES}
      optionRender={(option) => withFlag(option.data)}
      labelRender={(option) => withFlag(LANGUAGES.find((l) => l.value === option.value) ?? option)}
      style={{ width: 124, textAlign: 'left' }}
      onChange={(next) => {
        setLang(next);
        window.location.reload();
      }}
    />
  );
}
