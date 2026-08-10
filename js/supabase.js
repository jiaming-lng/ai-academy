/**
 * Supabase 客户端模块
 * 使用 Vite 环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
 * 本地开发时创建 .env 文件，部署时在平台配置环境变量
 *
 * 采用懒加载：仅当环境变量配置时才动态 import SDK，
 * 离线模式下无需安装 @supabase/supabase-js 即可正常运行。
 */

// fallback hardcoded values for production deployment
const _fallbackUrl = 'https://baoanljnpmorqsucqxud.supabase.co';
const _fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhb2FubGpucG1vcnFzdWNxeHVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MzM0MzksImV4cCI6MjEwMTQwOTQzOX0.f_zpPTcBVZHnPTmXgmWFl3aZswjYJOK9uCTsePKWjs0';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || _fallbackUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || _fallbackKey;

let supabase = null;

/**
 * 获取 Supabase 客户端实例（单例）
 * 如果环境变量未配置，返回 null（允许前端在离线模式运行）
 */
export async function getSupabase() {
  if (supabase) return supabase;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] 环境变量未配置，使用离线模式');
    return null;
  }
  try {
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
    console.warn('[Supabase] SDK 未安装，使用离线模式:', err.message);
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
