import { Particle } from './types';

export const createParticle = (x: number, y: number, color: string, type: 'dust' | 'water' | 'sparkle' | 'rain'): Particle => {
  let vx = (Math.random() - 0.5) * 0.5;
  let vy = (Math.random() - 0.5) * 0.5;
  let life = 20 + Math.random() * 20;
  let size = 1 + Math.random() * 2;

  if (type === 'dust') {
    vy = -Math.random() * 0.2; 
    life = 15 + Math.random() * 15;
    color = `rgba(200, 200, 200, ${0.3 + Math.random() * 0.3})`;
  } else if (type === 'water') {
    vx = (Math.random() - 0.5) * 0.2;
    vy = (Math.random() - 0.5) * 0.2;
    color = `rgba(135, 206, 250, ${0.5 + Math.random() * 0.5})`;
    size = 2;
  } else if (type === 'sparkle') {
    vx = 0;
    vy = -0.5;
    color = '#ffd700';
    life = 30;
  } else if (type === 'rain') {
      vx = -1.5; // Wind
      vy = 8 + Math.random() * 4; // Schnell fallend
      life = 60; // Länger leben damit sie den Screen durchqueren
      size = 1;
      color = `rgba(170, 190, 255, ${0.4 + Math.random() * 0.2})`;
  }

  return { x, y, vx, vy, life, maxLife: life, color, size, type };
};

export const updateParticles = (particles: Particle[]): Particle[] => {
  return particles
    .map(p => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      life: p.life - 1
    }))
    .filter(p => p.life > 0);
};

export const drawParticles = (ctx: CanvasRenderingContext2D, particles: Particle[]) => {
  particles.forEach(p => {
    ctx.fillStyle = p.color;
    
    if (p.type === 'rain') {
        // Regen als Striche zeichnen
        ctx.beginPath();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2); // Motion Blur effekt
        ctx.stroke();
    } else {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1.0;
    }
  });
};
