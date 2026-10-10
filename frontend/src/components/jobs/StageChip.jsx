import Icon from './icons.jsx';
import { STAGE_STYLE } from './stageStyle.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

/** Status pill: icon, colour and a word, so it never depends on colour alone. */
export default function StageChip({ stage, size = 'md' }) {
  const { t } = useLanguage();
  const style = STAGE_STYLE[stage];
  if (!style) return null;

  const sizing = size === 'lg' ? 'px-3.5 py-1.5 text-base' : 'px-2.5 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${style.chip} ${sizing}`}>
      <Icon name={style.icon} className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />
      {t(`stage.${stage}`)}
    </span>
  );
}
