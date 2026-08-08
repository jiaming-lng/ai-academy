// ============================================================
// logger.js — 轻量分级日志模块
// 设计目标：
//   - dev 环境（Vite）输出 debug/info/warn/error 全量
//   - prod 环境仅输出 warn/error，避免噪音
//   - report() 为生产错误上报钩子占位，后续可接监控端点
// ============================================================

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function currentLevel() {
  // Vite 注入 import.meta.env.DEV；静态直接打开时为 undefined → 仅 warn/error
  const isDev = Boolean(import.meta.env && import.meta.env.DEV);
  return isDev ? LEVELS.debug : LEVELS.warn;
}

function safeStringify(value) {
  if (typeof value !== 'object' || value === null) return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function format(args) {
  return args.map((a) => (typeof a === 'object' ? safeStringify(a) : a));
}

export const logger = {
  debug(...args) {
    if (currentLevel() <= LEVELS.debug) console.debug('[AI学社]', ...format(args));
  },
  info(...args) {
    if (currentLevel() <= LEVELS.info) console.info('[AI学社]', ...format(args));
  },
  warn(...args) {
    if (currentLevel() <= LEVELS.warn) console.warn('[AI学社]', ...format(args));
  },
  error(...args) {
    if (currentLevel() <= LEVELS.error) console.error('[AI学社]', ...format(args));
  },
  // 生产环境错误上报（占位）
  report(error) {
    if (currentLevel() > LEVELS.error) return;
    // TODO: 发送到监控端点，如 Sentry / 自建收集服务
    void error;
  },
};

export default logger;
