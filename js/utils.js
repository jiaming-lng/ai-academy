// ============================================================
// utils.js — 公共工具函数
// 被 courses.js / course-detail.js / 其他模块复用
// ============================================================

/**
 * HTML 转义 — 防止 XSS
 * @param {string} str
 * @returns {string} 转义后的安全 HTML
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * 数字格式化 — 超过 1万 显示为 x.x万
 * @param {number} n
 * @returns {string}
 */
export function formatNumber(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return String(n);
}

/**
 * 防抖函数
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay = 200) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
