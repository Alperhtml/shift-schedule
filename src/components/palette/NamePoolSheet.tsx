import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useT } from '../../i18n';
import { Sheet } from '../ui/Sheet';
import { NamePoolCard } from '../setup/NamePoolCard';

export function NamePoolSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const mobile = useMediaQuery('(max-width: 767px)');
  return (
    <Sheet open={open} side={mobile ? 'bottom' : 'right'} title={t('pool.title')} onClose={onClose}>
      <NamePoolCard showTitle={false} />
    </Sheet>
  );
}
