/* ============================================================
   sentry.js — Sentry 错误监控模块
   生产环境下自动上报运行时错误到 Sentry
   - dev 环境：仅 console 输出，不发送
   - prod 环境：有 DSN 则启用，无 DSN 则静默降级
   依赖: @sentry/browser (npm install @sentry/browser)
   ============================================================ */

const isProd = import.meta.env.PROD;
const dsn = import.meta.env.VITE_SENTRY_DSN || '';

let sentryReady = false;
let captureException = null;
let setUser = null;
let setTag = null;
let addBreadcrumb = null;

/**
 * 尝试加载 Sentry SDK，失败静默降级
 */
async function initSentry() {
  if (!dsn) {
    if (isProd) console.warn('[Sentry] 未配置 VITE_SENTRY_DSN，错误监控未启用');
    return;
  }

  try {
    const Sentry = await import(/* @vite-ignore */ '@sentry/browser');
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || 'production',
      release: import.meta.env.VITE_APP_VERSION || '0.3.0',
      tracesSampleRate: isProd ? 0.3 : 1.0,
      replaysSessionSampleRate: isProd ? 0.1 : 0,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      beforeSend(event) {
        // 过滤掉非关键错误
        if (event.exception) {
          const values = event.exception.values || [];
          const msg = values[0]?.value || '';
          // 忽略浏览器扩展引起的错误
          if (/chrome-extension/i.test(msg)) return null;
          // 忽略网络请求取消
          if (msg === 'AbortError' || msg === 'NetworkError') return null;
        }
        return event;
      },
    });

    Breadcrumbs = Sentry;
    captureException = Sentry.captureException.bind(Sentry);
    setUser = Sentry.setUser.bind(Sentry);
    setTag = Sentry.setTag.bind(Sentry);
    addBreadcrumb = Sentry.addBreadcrumb.bind(Sentry);
    sentryReady = true;
  } catch (err) {
    if (isProd) console.warn('[Sentry] SDK 加载失败，降级为静默模式:', err.message);
  }
}

// 立即初始化（不 await，不阻塞页面渲染）
initSentry();

// ===== 公开 API =====

/**
 * 上报异常
 * @param {Error | string} error
 * @param {object} [context] 额外上下文
 */
export function reportError(error, context = {}) {
  if (!sentryReady || !captureException) {
    if (isProd) console.error('[Sentry]', error, context);
    return;
  }
  captureException(typeof error === 'string' ? new Error(error) : error, {
    extra: context,
  });
}

/**
 * 设置当前用户信息（登录后调用）
 * @param {{ id: string; email?: string; name?: string }} user
 */
export function identifyUser(user) {
  if (!sentryReady || !setUser) return;
  setUser({
    id: user.id,
    email: user.email || undefined,
    username: user.name || undefined,
  });
}

/**
 * 清除用户信息（退出登录时调用）
 */
export function clearUser() {
  if (!sentryReady || !setUser) return;
  setUser(null);
}

/**
 * 设置全局标签（如页面名称）
 * @param {string} key
 * @param {string} value
 */
export function setGlobalTag(key, value) {
  if (!sentryReady || !setTag) return;
  setTag(key, value);
}

/**
 * 手动添加面包屑（调试用）
 * @param {{ message: string; category?: string; level?: 'info'|'warning'|'error'; data?: object }} crumb
 */
export function addLog(crumb) {
  if (!sentryReady || !addBreadcrumb) return;
  addBreadcrumb({
    message: crumb.message,
    category: crumb.category || 'manual',
    level: crumb.level || 'info',
    data: crumb.data || {},
    timestamp: Date.now() / 1000,
  });
}

/**
 * 检查 Sentry 是否已就绪
 */
export function isReady() {
  return sentryReady;
}

export default { reportError, identifyUser, clearUser, setGlobalTag, addLog, isReady };
