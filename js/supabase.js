/**
 * Supabase 客户端模块
 * 使用 Vite 环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
 * 本地开发时创建 .env 文件，部署时在平台配置环境变量
 */

// fallback hardcoded values for production deployment
const _fallbackUrl = 'https://baoanljnpmorqsucqxud.supabase.co';
const _fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhb2FubGpucG1vcnFzdWNxeHVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MzM0MzksImV4cCI6MjEwMTQwOTQzOX0.f_zpPTcBVZHnPTmXgmWFl3aZswjYJOK9uCTsePKWjs0';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || _fallbackUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || _fallbackKey;

// 清理可能被污染的 session token
try {
  const keys = Object.keys(localStorage);
  for (const k of keys) {
    if (k.startsWith('sb-') || k.includes('supabase')) {
      const val = localStorage.getItem(k);
      // 检查是否含有非 ASCII 字符
      if (val && /[^\x00-\x7F]/.test(val)) {
        console.warn('[Supabase] 清理被污染的 localStorage key:', k);
        localStorage.removeItem(k);
      }
    }
  }
} catch { /* noop */ }

let supabase = null;

/**
 * 获取配置（用于直接 REST API 调用）
 */
export function getConfig() {
  return { url: supabaseUrl, key: supabaseAnonKey };
}

/**
 * 直接 REST API 查询 courses 表（绕过 SDK，避免 Header 报错问题）
 */
export async function fetchCoursesREST() {
  try {
    const url = `${supabaseUrl}/rest/v1/courses?status=eq.published&order=sort_order&select=*`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    });
    if (!res.ok) {
      console.error('[REST] courses 查询失败:', res.status, res.statusText);
      return null;
    }
    const data = await res.json();
    console.log('[REST] courses 查询成功:', data.length, '门课程');
    return data;
  } catch (err) {
    console.error('[REST] courses 查询异常:', err.message);
    return null;
  }
}

/**
 * 获取 Supabase 客户端实例（单例）
 */
export async function getSupabase() {
  if (supabase) return supabase;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] 环境变量未配置，使用离线模式');
    return null;
  }
  try {
    // 静态导入 SDK（修复运行时找不到模块的问题）
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    console.log('[Supabase] 已连接');
    return supabase;
  } catch (err) {
    console.warn('[Supabase] 创建客户端失败:', err.message);
    return null;
  }
}

/**
 * 同步获取已初始化的 supabase 实例
 * 用于需要同步调用的场景（注意：仅返回已初始化实例，不触发动态加载）
 */
export function getSupabaseSync() {
  return supabase;
}

/**
 * 检查 Supabase 是否已配置
 */
export function isSupabaseReady() {
  return !!(supabaseUrl && supabaseAnonKey);
}
