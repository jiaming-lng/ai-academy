/* ============================================================
   hero-particles.js — Hero 区域粒子动画 (ES Module)
   使用 Canvas 绘制浮动粒子点阵 + 连线效果
   尊重 prefers-reduced-motion
   ============================================================ */

import { logger } from './logger.js';

/**
 * 初始化 Hero 粒子画布
 * @param {string} containerSelector - Hero 容器选择器
 */
export function initHeroParticles(containerSelector = '.hero') {
  const hero = document.querySelector(containerSelector);
  if (!hero) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  // 创建 canvas
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-particles-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  hero.style.position = hero.style.position || 'relative';
  hero.insertAdjacentElement('afterbegin', canvas);

  const ctx = canvas.getContext('2d');
  let particles = [];
  let animFrameId = null;

  // 粒子数量根据屏幕宽度动态调整
  const PARTICLE_BASE = 30;
  const CONNECTION_DIST = 150;
  const PARTICLE_SPEED = 0.3;

  function resize() {
    const rect = hero.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    // 重新生成粒子
    const count = Math.max(15, Math.floor(PARTICLE_BASE * (rect.width / 1280)));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        r: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * PARTICLE_SPEED,
        vy: (Math.random() - 0.5) * PARTICLE_SPEED,
        opacity: Math.random() * 0.5 + 0.2,
      });
    }
  }

  function draw() {
    const rect = hero.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const dotColor = isDark ? '255,255,255' : '107,138,255';
    const lineColor = isDark ? '255,255,255' : '107,138,255';

    // Update & draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      // Bounce off edges
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      // Draw particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${dotColor}, ${p.opacity})`;
      ctx.fill();
    }

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONNECTION_DIST) {
          const alpha = (1 - dist / CONNECTION_DIST) * 0.12;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${lineColor}, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    animFrameId = requestAnimationFrame(draw);
  }

  function cleanup() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    window.removeEventListener('resize', handleResize);
  }

  let resizeTimer;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  }

  resize();
  draw();
  window.addEventListener('resize', handleResize);

  // 主题切换时重新计算颜色（下一帧渲染自动使用最新主题）
  logger.info('Hero 粒子动画初始化完成');
  return cleanup;
}
