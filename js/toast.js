/* ============================================================
   toast.js — 轻量 Toast 通知组件 (ES Module)
   支持 success / error / info / warning 四种类型
   自动堆叠、自动消失、入场退场动画
   ============================================================ */

import { Icons } from './icons.js';

const CONTAINER_ID = 'toast-container';
const DEFAULT_DURATION = 4000;

const typeConfig = {
  success: { bg: '#E6FFF0', border: '#10B981', text: '#065F46', icon: 'check', iconColor: '#10B981' },
  error:   { bg: '#FFF0F0', border: '#E5484D', text: '#991B1B', icon: 'alert',  iconColor: '#E5484D' },
  info:    { bg: '#F0F3FF', border: '#6B8AFF', text: '#1E3A5F', icon: 'info',   iconColor: '#6B8AFF' },
  warning: { bg: '#FFF8F0', border: '#FFCB47', text: '#7C5A0B', icon: 'alert',  iconColor: '#FFCB47' },
};

/** 确保容器存在 */
function ensureContainer() {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-relevant', 'additions');
    container.style.cssText =
      'position:fixed;top:20px;right:20px;z-index:2000;display:flex;flex-direction:column;gap:10px;max-width:380px;pointer-events:none';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * 显示一个 Toast 通知
 * @param {string} message — 通知内容（纯文本，自动转义）
 * @param {'success'|'error'|'info'|'warning'} type — 类型
 * @param {number} [duration=4000] — 显示时长 ms
 */
export function showToast(message, type = 'info', duration = DEFAULT_DURATION) {
  const container = ensureContainer();
  const config = typeConfig[type] || typeConfig.info;

  // 创建 Toast 元素
  const toast = document.createElement('div');
  toast.className = 'toast-item';
  toast.setAttribute('role', 'status');
  toast.style.cssText = `
    display:flex;align-items:flex-start;gap:10px;
    padding:14px 16px;
    border-radius:10px;
    background:${config.bg};
    border:1px solid ${config.border};
    color:${config.text};
    font-size:14px;line-height:1.5;
    box-shadow:0 4px 16px rgba(0,0,0,.12);
    pointer-events:auto;
    opacity:0;
    transform:translateX(40px);
    transition:opacity 0.3s ease,transform 0.3s ease;
  `;

  // 图标
  const iconWrap = document.createElement('span');
  iconWrap.style.cssText = 'flex-shrink:0;width:20px;height:20px;margin-top:1px';
  iconWrap.innerHTML = Icons.get(config.icon, config.iconColor);
  toast.appendChild(iconWrap);

  // 文本
  const text = document.createElement('span');
  text.style.cssText = 'flex:1';
  text.textContent = message;
  toast.appendChild(text);

  // 关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', '关闭通知');
  closeBtn.style.cssText =
    'flex-shrink:0;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:6px;color:inherit;opacity:0.6;cursor:pointer;font-size:16px;line-height:1;transition:opacity 0.15s';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('mouseenter', () => { closeBtn.style.opacity = '1'; });
  closeBtn.addEventListener('mouseleave', () => { closeBtn.style.opacity = '0.6'; });
  closeBtn.addEventListener('click', () => dismiss(toast));
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  // 入场动画
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });

  // 自动消失
  const timer = setTimeout(() => dismiss(toast), duration);
  toast._dismissTimer = timer;

  return toast;
}

/** 移除 Toast（带动画） */
function dismiss(toast) {
  if (toast._dismissed) return;
  toast._dismissed = true;
  clearTimeout(toast._dismissTimer);

  toast.style.opacity = '0';
  toast.style.transform = 'translateX(40px)';

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 300);
}
