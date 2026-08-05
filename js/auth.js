// ============================================================
// auth.js — 统一认证模块
// 使用 db.js 统一数据层，自动切换 Supabase / localStorage
// 保持原有 API 签名不变，确保现有代码无需改动
// ============================================================

import { logger } from './logger.js';
import { dbSignUp, dbSignIn, dbSignOut, dbGetCurrentUser, dbOnAuthChange, dbResetPassword, dbUpdatePassword, dbSignInWithOAuth } from './db.js';
import { identifyUser, clearUser } from './sentry.js';

/**
 * 注册新用户
 * @param {{ name: string, email: string, password: string }} params
 * @returns {Promise<{ success: boolean, message: string, needsVerification?: boolean }>}
 */
export async function register({ name, email, password }) {
  try {
    const data = await dbSignUp(email, password, name);
    // 检查是否需要邮箱验证
    const needsVerification = data.user && !data.session;
    if (needsVerification) {
      logger.info('用户注册成功，等待邮箱验证', { email });
      return {
        success: true,
        message: '注册成功！请检查邮箱 ' + email + ' 中的验证链接完成激活。',
        needsVerification: true,
      };
    }
    logger.info('用户注册成功', { email, name });
    return { success: true, message: '欢迎加入 AI学社，' + name + '！' };
  } catch (err) {
    logger.warn('注册失败', { email, error: err.message });
    const msg = err.message.includes('already registered') || err.message.includes('已注册')
      ? '该邮箱已被注册，请直接登录或使用其他邮箱'
      : '注册失败：' + err.message;
    return { success: false, message: msg };
  }
}

/**
 * 登录
 * @param {{ email: string, password: string }} params
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function login({ email, password }) {
  try {
    const data = await dbSignIn(email, password);
    const name = data.user?.user_metadata?.full_name || email;
    // Sentry: 关联用户
    identifyUser({ id: data.user?.id, email, name });
    logger.info('用户登录成功', { email, name });
    return { success: true, message: '欢迎回来，' + name + '！' };
  } catch (err) {
    logger.warn('登录失败', { email, error: err.message });
    const msg = err.message.includes('Invalid login') || err.message.includes('密码')
      ? '密码错误，请重试'
      : err.message.includes('not found') || err.message.includes('不存在')
        ? '该邮箱尚未注册，请先注册'
        : '登录失败：' + err.message;
    return { success: false, message: msg };
  }
}

/**
 * 登出
 */
export async function logout() {
  await dbSignOut();
  clearUser();
  logger.info('用户已登出');
}

/**
 * 获取当前登录用户
 * @returns {Promise<{ id?: string, name: string, email: string } | null>}
 */
let cachedUser = null;

export async function getCurrentUser() {
  try {
    const user = await dbGetCurrentUser();
    if (user) {
      cachedUser = {
        id: user.id,
        name: user.profile?.full_name || user.user_metadata?.full_name || user.email,
        email: user.email,
      };
      // Sentry: 恢复用户关联
      identifyUser({ id: user.id, email: user.email, name: cachedUser.name });
      return cachedUser;
    }
    cachedUser = null;
    return null;
  } catch {
    return cachedUser;
  }
}

/**
 * 同步版本的 getCurrentUser（用于 DOM 渲染等同步场景）
 * 返回缓存值，可能不准确，优先使用 async 版本
 */
export function getCurrentUserSync() {
  return cachedUser;
}

/**
 * 是否已登录（同步，基于缓存）
 */
export function isLoggedIn() {
  return !!cachedUser;
}

/**
 * 初始化认证监听
 * 在应用启动时调用一次，监听 Supabase auth 状态变化
 */
export function initAuth(callback) {
  // 先检查当前状态
  dbGetCurrentUser().then(user => {
    if (user) {
      cachedUser = {
        id: user.id,
        name: user.profile?.full_name || user.user_metadata?.full_name || user.email,
        email: user.email,
      };
    }
    if (callback) callback(cachedUser);
  });

  // 监听变化
  dbOnAuthChange(async (event, supabaseUser) => {
    if (event === 'SIGNED_IN' && supabaseUser) {
      cachedUser = {
        id: supabaseUser.id,
        name: supabaseUser.user_metadata?.full_name || supabaseUser.email,
        email: supabaseUser.email,
      };
    } else if (event === 'SIGNED_OUT') {
      cachedUser = null;
    }
    if (callback) callback(cachedUser);
  });
}

/**
 * 发送密码重置邮件
 * @param {string} email
 * @param {string} [redirectTo]
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function resetPassword(email, redirectTo) {
  try {
    await dbResetPassword(email, redirectTo);
    return { success: true, message: '密码重置邮件已发送至 ' + email + '，请检查邮箱。' };
  } catch (err) {
    return { success: false, message: '发送失败：' + err.message };
  }
}

/**
 * 更新密码（密码重置流程第二步）
 * @param {string} newPassword
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function updatePassword(newPassword) {
  try {
    await dbUpdatePassword(newPassword);
    return { success: true, message: '密码修改成功！即将跳转到首页...' };
  } catch (err) {
    return { success: false, message: '修改失败：' + err.message };
  }
}

/**
 * OAuth 社交登录
 * @param {'github'|'google'} provider
 * @param {string} [redirectTo]
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function signInWithOAuth(provider, redirectTo) {
  try {
    await dbSignInWithOAuth(provider, redirectTo);
    return { success: true, message: '正在跳转...' };
  } catch (err) {
    return { success: false, message: 'OAuth 登录失败：' + err.message };
  }
}
