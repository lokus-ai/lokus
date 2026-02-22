import { useRef } from 'react';

export function useVersionTracking() {
  const lastVersionContentRef = useRef({});
  const lastVersionSaveRef = useRef({});

  return { lastVersionContentRef, lastVersionSaveRef };
}
