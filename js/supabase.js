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

// 静态导入 SDK（修复运行时找不到模块的问题）
import { createClient } from '@supabase/supabase-js';

let supabase = null;

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
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    console.log('[Supabase] 已连接');
    // 调试：测试第一个查询
    supabase.from('courses').select('id', { count: 'exact', head: true }).limit(1)
      .then(({ data, error }) => {
        if (error) console.error('[Supabase] 测试查询失败:', error);
        else console.log('[Supabase] 测试查询成功，行数:', data);
      }).catch(err => console.error('[Supabase] 测试查询异常:', err));
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
