/**
 * 统一数据访问层
 * 优先使用 Supabase 真实数据库，未配置时降级为 localStorage 离线模式
 * 所有页面通过此模块访问数据，无需关心底层实现
 */
import { getSupabase } from './supabase.js';

// ============================================================
// 通用工具
// ============================================================
function storageGet(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function storageSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota exceeded */ }
}

// ============================================================
// Auth 模块
// ============================================================
export async function dbSignUp(email, password, name) {
  // 优先 REST API
  try {
    const { authSignUp } = await import('./supabase.js');
    const data = await authSignUp(email, password, name);
    if (data.user) {
      localStorage.setItem('ai_academy_current_user', JSON.stringify({
        id: data.user.id, email: data.user.email, name
      }));
    }
    return data;
  } catch (restErr) {
    // 回落到 localStorage
    console.warn('[dbSignUp] REST failed, fallback:', restErr.message);
  }
  // Offline fallback
  const users = storageGet('ai_academy_users') || {};
  if (users[email]) throw new Error('该邮箱已注册');
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password + email));
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  users[email] = { name, passwordHash: hash, createdAt: new Date().toISOString() };
  storageSet('ai_academy_users', users);
  localStorage.setItem('ai_academy_current_user', JSON.stringify({ email, name }));
  return { user: { email, user_metadata: { full_name: name } } };
}

export async function dbSignIn(email, password) {
  // 优先 REST API
  try {
    const { authSignIn } = await import('./supabase.js');
    const data = await authSignIn(email, password);
    if (data.user) {
      localStorage.setItem('ai_academy_current_user', JSON.stringify({
        id: data.user.id, email: data.user.email, name: data.user.user_metadata?.full_name || email.split('@')[0]
      }));
    }
    return data;
  } catch (restErr) {
    // 回落到 localStorage
    const users = storageGet('ai_academy_users') || {};
    const user = users[email];
    if (!user) throw restErr;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password + email));
    const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== user.passwordHash) throw new Error('密码错误');
    localStorage.setItem('ai_academy_current_user', JSON.stringify({ email, name: user.name }));
    return { user: { email, user_metadata: { full_name: user.name } } };
  }
  // Offline fallback
  const users = storageGet('ai_academy_users') || {};
  const user = users[email];
  if (!user) throw new Error('用户不存在');
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password + email));
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== user.passwordHash) throw new Error('密码错误');
  localStorage.setItem('ai_academy_current_user', JSON.stringify({ email, name: user.name }));
  return { user: { email, user_metadata: { full_name: user.name } } };
}

export async function dbSignOut() {
  try {
    const { authSignOut } = await import('./supabase.js');
    await authSignOut();
  } catch { /* noop */ }
  localStorage.removeItem('ai_academy_current_user');
}

export async function dbGetCurrentUser() {
  // 优先 REST API
  try {
    const { authGetUser } = await import('./supabase.js');
    const user = await authGetUser();
    if (user) return user;
  } catch { /* fallback */ }
  // Offline fallback
  const stored = localStorage.getItem('ai_academy_current_user');
  return stored ? JSON.parse(stored) : null;
}

export async function dbOnAuthChange(callback) {
  const sb = await getSupabase();
  if (sb) {
    sb.auth.onAuthStateChange((event, session) => {
      callback(event, session?.user || null);
    });
  }
  // Offline: don't listen (single-tab)
}

/** 发送密码重置邮件 */
export async function dbResetPassword(email, redirectTo) {
  const sb = await getSupabase();
  if (sb) {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || `${window.location.origin}/reset-password.html`,
    });
    if (error) throw error;
    return;
  }
  // Offline: no email service
  throw new Error('离线模式不支持密码重置');
}

/** 更新密码（用于重置密码流程） */
export async function dbUpdatePassword(newPassword) {
  const sb = await getSupabase();
  if (sb) {
    const { data, error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  }
  // Offline: update localStorage
  const stored = localStorage.getItem('ai_academy_current_user');
  if (!stored) throw new Error('未登录');
  const user = JSON.parse(stored);
  const users = storageGet('ai_academy_users') || {};
  if (users[user.email]) {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(newPassword + user.email));
    users[user.email].passwordHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    storageSet('ai_academy_users', users);
  }
}

/** OAuth 登录 */
export async function dbSignInWithOAuth(provider, redirectTo) {
  const sb = await getSupabase();
  if (sb) {
    const { data, error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo || window.location.origin },
    });
    if (error) throw error;
    return data;
  }
  throw new Error('离线模式不支持OAuth登录');
}

// ============================================================
// 课程模块
// ============================================================
export async function dbGetCourses() {
  // BUILD-MARKER-20260810B — force GitHub Pages CDN cache invalidation
  console.log('[ai-academy] dbGetCourses v20260810B using REST');
  const { fetchCoursesREST } = await import('./supabase.js');
  const rest = await fetchCoursesREST();
  if (rest && rest.length > 0) return rest;
  if (rest === null) {
    // REST 失败（不是空数据），尝试本地数据
    const mod = await import('./config/courses.data.js');
    return mod.courses;
  }
  // 降级到 SDK
  const sb = await getSupabase();
  if (sb) {
    const { data, error } = await sb.from('courses').select('*').eq('status', 'published').order('sort_order');
    if (error) throw error;
    return data;
  }
  // Offline: use bundled data
  const mod = await import('./config/courses.data.js');
  return mod.courses;
}

export async function dbGetCourse(id) {
  const { fetchCourseREST } = await import('./supabase.js');
  const rest = await fetchCourseREST(id);
  if (rest) return rest;
  const mod = await import('./config/courses.data.js');
  return mod.courses.find(c => c.id === id) || null;
}

export async function dbGetLessons(courseId) {
  const sb = await getSupabase();
  if (sb) {
    const { data, error } = await sb.from('lessons').select('*').eq('course_id', courseId).order('sort_order');
    if (error) throw error;
    return data;
  }
  // Offline: generate mock lessons
  const course = await dbGetCourse(courseId);
  if (!course) return [];
  return (course.outline || []).map((item, i) => ({
    id: `${courseId}-lesson-${i + 1}`,
    course_id: courseId,
    title: item.title,
    duration_min: parseInt(item.duration) || 10,
    sort_order: i + 1,
    type: 'video',
    is_free: i === 0,
  }));
}

// ============================================================
// 报名 & 进度
// ============================================================
export async function dbEnrollCourse(courseId) {
  const user = await dbGetCurrentUser();
  if (!user) throw new Error('请先登录');
  const userId = user.id || user.email;
  const sb = await getSupabase();
  if (sb) {
    const { error } = await sb.from('enrollments').insert({ user_id: userId, course_id: courseId });
    if (error && error.code !== '23505') throw error; // 23505 = duplicate OK
    return;
  }
  const enrollments = storageGet('ai_academy_enrollments') || {};
  if (!enrollments[userId]) enrollments[userId] = [];
  if (!enrollments[userId].includes(courseId)) {
    enrollments[userId].push(courseId);
    storageSet('ai_academy_enrollments', enrollments);
  }
}

export async function dbGetMyEnrollments() {
  const user = await dbGetCurrentUser();
  if (!user) return [];
  const userId = user.id || user.email;
  const sb = await getSupabase();
  if (sb) {
    const { data, error } = await sb.from('enrollments').select('*, courses(*)').eq('user_id', userId);
    if (error) throw error;
    return data;
  }
  const enrollments = storageGet('ai_academy_enrollments') || {};
  const courseIds = enrollments[userId] || [];
  const mod = await import('./config/courses.data.js');
  return courseIds.map(cid => {
    const course = mod.courses.find(c => c.id === cid);
    return { course_id: cid, courses: course, progress_pct: 0, enrolled_at: new Date().toISOString() };
  }).filter(Boolean);
}

export async function dbSaveProgress(lessonId, data) {
  const user = await dbGetCurrentUser();
  if (!user) return;
  const userId = user.id || user.email;
  const sb = await getSupabase();
  if (sb) {
    const { error } = await sb.from('progress').upsert({
      user_id: userId,
      lesson_id: lessonId,
      completed: data.completed || false,
      watched_seconds: data.watched_seconds || 0,
      notes: data.notes || null,
      completed_at: data.completed ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,lesson_id' });
    if (error) throw error;
    return;
  }
  const progress = storageGet('ai_academy_progress') || {};
  const key = `${userId}:${lessonId}`;
  progress[key] = { ...(progress[key] || {}), ...data, updatedAt: new Date().toISOString() };
  storageSet('ai_academy_progress', progress);
}

export async function dbGetProgress(lessonId) {
  const user = await dbGetCurrentUser();
  if (!user) return null;
  const userId = user.id || user.email;
  const sb = await getSupabase();
  if (sb) {
    const { data, error } = await sb.from('progress').select('*').eq('user_id', userId).eq('lesson_id', lessonId).single();
    if (error && error.code !== 'PGRST116') throw error; // not found OK
    return data;
  }
  const progress = storageGet('ai_academy_progress') || {};
  return progress[`${userId}:${lessonId}`] || null;
}

// ============================================================
// 社区模块
// ============================================================
export async function dbGetPosts(page = 1, limit = 10, tag = '') {
  const sb = await getSupabase();
  if (sb) {
    let query = sb.from('posts').select('*, profiles(username, full_name, avatar_url)').order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (tag) query = query.contains('tags', [tag]);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
  const posts = storageGet('ai_academy_posts') || [];
  let filtered = posts;
  if (tag) filtered = filtered.filter(p => (p.tags || []).includes(tag));
  filtered = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return filtered.slice((page - 1) * limit, page * limit);
}

export async function dbCreatePost(title, content, tags = []) {
  const user = await dbGetCurrentUser();
  if (!user) throw new Error('请先登录');
  const userId = user.id || user.email;
  const sb = await getSupabase();
  if (sb) {
    const { data, error } = await sb.from('posts').insert({ user_id: userId, title, content, tags }).select().single();
    if (error) throw error;
    return data;
  }
  const posts = storageGet('ai_academy_posts') || [];
  const post = {
    id: 'post_' + Date.now(),
    user_id: userId,
    title,
    content,
    tags,
    likes_count: 0,
    comments_count: 0,
    created_at: new Date().toISOString(),
    profiles: { username: user.email, full_name: user.name || user.email },
  };
  posts.unshift(post);
  storageSet('ai_academy_posts', posts);
  return post;
}

export async function dbGetComments(postId) {
  const sb = await getSupabase();
  if (sb) {
    const { data, error } = await sb.from('comments').select('*, profiles(username, full_name, avatar_url)').eq('post_id', postId).order('created_at');
    if (error) throw error;
    return data;
  }
  const comments = storageGet('ai_academy_comments') || {};
  return comments[postId] || [];
}

export async function dbCreateComment(postId, content, parentId = null) {
  const user = await dbGetCurrentUser();
  if (!user) throw new Error('请先登录');
  const userId = user.id || user.email;
  const sb = await getSupabase();
  if (sb) {
    const { data, error } = await sb.from('comments').insert({ post_id: postId, user_id: userId, content, parent_id: parentId }).select().single();
    if (error) throw error;
    return data;
  }
  const comments = storageGet('ai_academy_comments') || {};
  if (!comments[postId]) comments[postId] = [];
  const comment = {
    id: 'comment_' + Date.now(),
    post_id: postId,
    user_id: userId,
    content,
    parent_id: parentId,
    likes_count: 0,
    created_at: new Date().toISOString(),
    profiles: { username: user.email, full_name: user.name || user.email },
  };
  comments[postId].push(comment);
  storageSet('ai_academy_comments', comments);
  return comment;
}

export async function dbToggleLike(targetType, targetId) {
  const user = await dbGetCurrentUser();
  if (!user) throw new Error('请先登录');
  const userId = user.id || user.email;
  const sb = await getSupabase();
  if (sb) {
    const { data: existing } = await sb.from('likes').select('id').eq('user_id', userId).eq('target_type', targetType).eq('target_id', targetId).single();
    if (existing) {
      await sb.from('likes').delete().eq('id', existing.id);
      return { liked: false };
    } else {
      await sb.from('likes').insert({ user_id: userId, target_type: targetType, target_id: targetId });
      return { liked: true };
    }
  }
  const likes = storageGet('ai_academy_likes') || [];
  const key = `${userId}:${targetType}:${targetId}`;
  const idx = likes.indexOf(key);
  if (idx >= 0) { likes.splice(idx, 1); storageSet('ai_academy_likes', likes); return { liked: false }; }
  likes.push(key);
  storageSet('ai_academy_likes', likes);
  return { liked: true };
}

// ============================================================
// Profile 模块
// ============================================================
export async function dbUpdateProfile(updates) {
  const user = await dbGetCurrentUser();
  if (!user) throw new Error('请先登录');
  const userId = user.id || user.email;
  const sb = await getSupabase();
  if (sb) {
    const { error } = await sb.from('profiles').update(updates).eq('id', userId);
    if (error) throw error;
    return;
  }
  const profiles = storageGet('ai_academy_profiles') || {};
  profiles[userId] = { ...(profiles[userId] || {}), ...updates, updatedAt: new Date().toISOString() };
  storageSet('ai_academy_profiles', profiles);
}

export async function dbGetProfile() {
  const user = await dbGetCurrentUser();
  if (!user) return null;
  const userId = user.id || user.email;
  const sb = await getSupabase();
  if (sb) {
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (error) throw error;
    return data;
  }
  const profiles = storageGet('ai_academy_profiles') || {};
  return profiles[userId] || { full_name: user.name || user.email, bio: '', github_url: '', website: '' };
}

// ============================================================
// Newsletter 订阅
// ============================================================
export async function dbSubscribe(email) {
  const sb = await getSupabase();
  if (sb) {
    const { error } = await sb.from('subscriptions').insert({ email });
    if (error && error.code !== '23505') throw error;
    return;
  }
  const subs = storageGet('ai_academy_subscriptions') || [];
  if (!subs.includes(email)) { subs.push(email); storageSet('ai_academy_subscriptions', subs); }
}

// ============================================================
// 学习统计
// ============================================================
export async function dbGetStats() {
  const user = await dbGetCurrentUser();
  if (!user) return null;
  const userId = user.id || user.email;
  const sb = await getSupabase();
  if (sb) {
    const [{ count: totalLessons }, { count: completed }, { count: courses }] = await Promise.all([
      sb.from('progress').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      sb.from('progress').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('completed', true),
      sb.from('enrollments').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ]);
    return { totalLessons, completedLessons: completed, enrolledCourses: courses };
  }
  const progress = storageGet('ai_academy_progress') || {};
  const keys = Object.keys(progress).filter(k => k.startsWith(`${userId}:`));
  const completed = keys.filter(k => progress[k].completed).length;
  const enrollments = storageGet('ai_academy_enrollments') || {};
  const courses = (enrollments[userId] || []).length;
  return { totalLessons: keys.length, completedLessons: completed, enrolledCourses: courses };
}
