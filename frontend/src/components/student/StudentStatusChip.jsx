import Icon from '../jobs/icons.jsx';
import { STAGE_STYLE } from '../jobs/stageStyle.js';
import { STUDENT_STAGE_STYLE_KEY } from './categoryStyle.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

/** Where a problem stands, in the student's words: icon, colour and a word. */
export default function StudentStatusChip({ stage, size = 'md' }) {
  const { t } = useLanguage();
  const style = STAGE_STYLE[STUDENT_STAGE_STYLE_KEY[stage]];
  if (!style) return null;
  const sizing = size === 'lg' ? 'px-3.5 py-1.5 text-base' : 'px-2.5 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${style.chip} ${sizing}`}>
      <Icon name={style.icon} className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />
      {t(`sstage.${stage}`)}
    </span>
  );
}
