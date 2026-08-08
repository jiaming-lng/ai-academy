/**
 * dashboard.js — 学习仪表盘
 * 支持 Supabase 真实数据 + localStorage 离线降级
 */
import { getCurrentUser } from './auth.js';
import { dbGetMyEnrollments, dbGetStats } from './db.js';
import { logger } from './logger.js';

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', async () => {
  const user = await getCurrentUser();

  const loginPrompt = document.getElementById('loginPrompt');
  const dashboardContent = document.getElementById('dashboardContent');

  if (!user) {
    if (loginPrompt) loginPrompt.style.display = '';
    if (dashboardContent) dashboardContent.style.display = 'none';
    return;
  }

  if (loginPrompt) loginPrompt.style.display = 'none';
  if (dashboardContent) dashboardContent.style.display = '';

  await loadStats();
  await loadMyCourses();
  loadCalendar();
});

// ===== 统计卡片 =====
async function loadStats() {
  const statsGrid = document.getElementById('statsGrid');
  if (!statsGrid) return;

  try {
    const stats = await dbGetStats();
    const enrollments = await dbGetMyEnrollments();

    const cards = [
      { icon: 'book-open', color: '#6B8AFF', label: '已报名课程', value: stats?.enrolledCourses || enrollments.length },
      { icon: 'check-circle', color: '#10B981', label: '已完成课时', value: stats?.completedLessons || 0 },
      { icon: 'clock', color: '#F59E0B', label: '学习总时长', value: '--', suffix: ' 小时' },
      { icon: 'award', color: '#EC4899', label: '获得证书', value: 0 },
    ];

    statsGrid.innerHTML = cards.map(c => `
      <div class="stat-card">
        <span class="stat-icon" data-icon="${c.icon}" data-icon-color="${c.color}" data-icon-size="32"></span>
        <div class="stat-info">
          <span class="stat-value">${c.value}${c.suffix || ''}</span>
          <span class="stat-label">${c.label}</span>
        </div>
      </div>
    `).join('');

    // Render icons
    const { Icons } = await import('./icons.js');
    Icons.renderAll();
  } catch (err) {
    logger.error('加载统计失败', err);
  }
}

// ===== 我的课程 =====
async function loadMyCourses() {
  const grid = document.getElementById('myCoursesGrid');
  const empty = document.getElementById('myCoursesEmpty');
  const countEl = document.getElementById('enrolledCount');
  if (!grid) return;

  try {
    const enrollments = await dbGetMyEnrollments();

    if (enrollments.length === 0) {
      if (grid) grid.style.display = 'none';
      if (empty) empty.style.display = '';
      return;
    }

    if (empty) empty.style.display = 'none';
    if (grid) grid.style.display = '';
    if (countEl) countEl.textContent = `(${enrollments.length}门)`;

    grid.innerHTML = enrollments.map(e => {
      const course = e.courses;
      if (!course) return '';
      const progress = e.progress_pct || 0;
      return `
        <a href="course-detail.html?id=${course.id}" class="course-card" style="text-decoration:none;">
          <div class="course-card-image" style="background:${course.iconColor || '#6B8AFF'}15;">
            <span data-icon="${course.icon || 'book-open'}" data-icon-color="${course.iconColor || '#6B8AFF'}" data-icon-size="48"></span>
          </div>
          <div class="course-card-body">
            <span class="course-card-category">${course.category || ''}</span>
            <h3 class="course-card-title">${course.title}</h3>
            <p class="course-card-desc">${course.subtitle || ''}</p>
            <div class="progress-bar-wrap">
              <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width:${progress}%;"></div>
              </div>
              <span class="progress-bar-text">${progress}%</span>
            </div>
            <div class="course-card-footer">
              ${progress > 0 ? `<a href="lesson.html?course=${course.id}" class="btn btn-primary btn-sm">继续学习</a>` : `<a href="course-detail.html?id=${course.id}" class="btn btn-outline btn-sm">开始学习</a>`}
            </div>
          </div>
        </a>
      `;
    }).join('');

    const { Icons } = await import('./icons.js');
    Icons.renderAll();
  } catch (err) {
    logger.error('加载课程失败', err);
    if (empty) empty.style.display = '';
  }
}

// ===== 学习日历 =====
function loadCalendar() {
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  const days = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    // Simulated: random 60% chance of study activity
    const hasActivity = Math.random() > 0.4;
    const level = hasActivity ? Math.ceil(Math.random() * 4) : 0;
    days.push({ date: dateStr, day: d.getDate(), level });
  }

  grid.innerHTML = days.map(d => `
    <div class="calendar-day ${d.level > 0 ? 'has-activity' : ''} level-${d.level}"
         title="${d.date}${d.level > 0 ? ' · ' + d.level + ' 课时完成' : ' · 无学习记录'}">
      <span>${d.day}</span>
    </div>
  `).join('');
}
