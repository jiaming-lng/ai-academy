// ============================================================
// supabase.js — 纯 REST API 客户端（不依赖 @supabase/supabase-js）
// 直接用 fetch 调用 PostgREST，避免 SDK 的复杂行为
// ============================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://baoanljnpmorqsucqxud.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhb2FubGpucG1vcnFzdWNxeHVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MzM0MzksImV4cCI6MjEwMTQwOTQzOX0.f_zpPTcBVZHnPTmXgmWFl3aZswjYJOK9uCTsePKWjs0';

// 通用 headers（纯 ASCII，永不报错）
const baseHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
};

/**
 * GET 请求辅助函数
 */
async function supabaseGet(table, query = '') {
  const url = SUPABASE_URL + '/rest/v1/' + table + (query ? '?' + query : '');
  try {
    const res = await fetch(url, { method: 'GET', headers: baseHeaders });
    if (!res.ok) {
      console.error('[Supabase GET]', table, 'failed:', res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[Supabase GET]', table, 'error:', err.message);
    return null;
  }
}

/**
 * 获取已发布的课程列表
 */
export async function fetchCoursesREST() {
  const query = 'status=eq.published&order=sort_order&select=*';
  const data = await supabaseGet('courses', query);
  if (data) console.log('[REST] courses:', data.length);
  return data;
}

/**
 * 获取单个课程
 */
export async function fetchCourseREST(id) {
  const data = await supabaseGet('courses', 'id=eq.' + encodeURIComponent(id) + '&select=*');
  return data && data[0] ? data[0] : null;
}

/**
 * 获取某课程的所有课时
 */
export async function fetchLessonsREST(courseId) {
  const query = 'course_id=eq.' + encodeURIComponent(courseId) + '&order=sort_order&select=*';
  return await supabaseGet('lessons', query);
}

/**
 * 获取当前用户 profile（通过 auth.getUser）
 */
export async function fetchCurrentUserREST() {
  try {
    // 从 localStorage 取 session
    const sessionRaw = localStorage.getItem('sb-baoanljnpmorqsucqxud-auth-token');
    if (!sessionRaw) return null;
    const session = JSON.parse(sessionRaw);
    if (!session.access_token) return null;

    const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + session.access_token,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// 旧 API 兼容（已废弃）
export async function getSupabase() { return null; }
export function getSupabaseSync() { return null; }
export function isSupabaseReady() { return !!SUPABASE_URL; }
export function getConfig() { return { url: SUPABASE_URL, key: SUPABASE_KEY }; }