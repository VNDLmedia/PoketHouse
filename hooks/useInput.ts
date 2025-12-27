import { useEffect, useState, useCallback } from 'react';

type KeyState = Record<string, boolean>;

export const useInput = () => {
  const [keys, setKeys] = useState<KeyState>({});

  // Für Touch Controls
  const setKey = useCallback((code: string, pressed: boolean) => {
    setKeys((prev) => {
        if (prev[code] === pressed) return prev;
        return { ...prev, [code]: pressed };
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default scrolling for game keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
      }
      setKeys((prev) => ({ ...prev, [e.code]: true }));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys((prev) => ({ ...prev, [e.code]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    // Fokus behalten
    window.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return { keys, setKey };
};
