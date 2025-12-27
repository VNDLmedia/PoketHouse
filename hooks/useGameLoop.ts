import { useEffect, useRef } from 'react';

export const useGameLoop = (
  update: (deltaTime: number) => void,
  render: (ctx: CanvasRenderingContext2D) => void,
  canvasRef: React.RefObject<HTMLCanvasElement | null>
) => {
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);
  
  const updateRef = useRef(update);
  const renderRef = useRef(render);

  useEffect(() => {
    updateRef.current = update;
    renderRef.current = render;
  }, [update, render]);

  const animate = (time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      
      updateRef.current(deltaTime);
      
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderRef.current(ctx);
        }
      }
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);
};
