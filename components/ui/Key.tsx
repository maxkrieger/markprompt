import { FC, ReactNode, useEffect, useState } from 'react';

import { isMacLike } from '@/lib/utils';

interface KeyProps {
  cmdCtrl?: boolean;
  className?: string;
  children?: ReactNode;
}

export const Key: FC<KeyProps> = ({ cmdCtrl, className, children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Prevent hydration errors associated with isMacLike() check
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <kbd className={className}>
      {cmdCtrl && isMacLike() ? '⌘' : 'Ctrl'} {children}
    </kbd>
  );
};
