import { useT } from '../../i18n';

/** The Koç mark and the application name, used by both screens. */
export function AppMark({ size = 'lg' }: { size?: 'lg' | 'sm' | undefined }) {
  const t = useT();
  const big = size === 'lg';
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <img
        src="./koc-logo.png"
        alt=""
        aria-hidden
        width={big ? 30 : 24}
        height={big ? 25 : 20}
        className={big ? 'h-[25px] w-[30px] shrink-0' : 'h-5 w-6 shrink-0'}
      />
      <span className={`truncate font-semibold tracking-[-0.02em] text-text ${big ? 'text-[22px]' : 'text-[17px] md:text-[22px]'}`}>
        {t('app.title')}
      </span>
    </span>
  );
}
