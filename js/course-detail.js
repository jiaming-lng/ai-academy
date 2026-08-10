// ============================================================
// course-detail.js — 课程详情页动态渲染 (Phase 4)
// 读取 URL ?id= → 查找课程 → 渲染页面
// 无 id / 找不到 → 跳转 404
// 依赖: db.js (Supabase/localStorage), icons.js, logger.js
// ============================================================

import { dbGetCourse } from './db.js';
import { Icons } from './icons.js';
import { logger } from './logger.js';
import { escapeHtml, formatNumber } from './utils.js';

/**
 * 将数据库/硬编码字段统一映射为前端渲染所需字段
 */
function normalizeCourse(c) {
  if (!c) return null;
  const level = c.level || c.difficulty || 'beginner';
  const difficultyLabel = (() => {
    if (level === 'beginner') return '入门';
    if (level === 'intermediate') return '进阶';
    if (level === 'advanced') return '高级';
    return c.difficultyLabel || level;
  })();
  return {
    id: c.id,
    title: c.title || '',
    subtitle: c.subtitle || '',
    description: c.description || '',
    summary: c.summary || c.subtitle || (c.description || '').slice(0, 80),
    difficulty: level,
    difficultyLabel,
    weeks: c.weeks || Math.ceil((c.duration_hours || 24) / 3),
    lessons: c.lessons || c.lessons_count || 0,
    enrolled: c.enrolled || c.students_count || 0,
    rating: c.rating || 0,
    price: c.price || 0,
    originalPrice: c.originalPrice || c.original_price || c.price || 0,
    icon: c.icon || 'book',
    iconColor: c.icon_color || c.iconColor || '#6B8AFF',
    gradientFrom: c.gradientFrom || c.gradient_from || 'var(--color-primary-soft)',
    gradientTo: c.gradientTo || c.gradient_to || '#E8EEFF',
    syllabus: c.syllabus || c.outline || [],
    instructor: c.instructor || null,
  };
}

/**
 * 渲染课程详情头部
 */
function renderHeader(course) {
  return `
    <div class="course-detail-info">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="index.html">首页</a>
        <span class="breadcrumb-sep">/</span>
        <a href="courses.html">课程</a>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">${escapeHtml(course.title)}</span>
      </nav>
      <div class="course-tag-row">
        <span class="difficulty ${course.difficulty}">${course.difficultyLabel}</span>
        <a href="courses.html" class="back-link">&larr; 返回课程列表</a>
      </div>
      <h1>${escapeHtml(course.title)}</h1>
      <p class="course-desc">${escapeHtml(course.description)}</p>
      <div class="course-meta-row">
        <span><span data-icon="clock" data-icon-color="#6B6B8A" style="display:inline-flex;vertical-align:middle;width:18px;height:18px;"></span> ${course.weeks} 周 · ${course.lessons} 课时</span>
        <span><span data-icon="users" data-icon-color="#6B6B8A" style="display:inline-flex;vertical-align:middle;width:18px;height:18px;"></span> ${formatNumber(course.enrolled)} 人已学习</span>
        <span><span data-icon="star" data-icon-color="#FFCB47" style="display:inline-flex;vertical-align:middle;width:18px;height:18px;"></span> ${course.rating} 评分</span>
      </div>
    </div>

    <div class="course-detail-visual" style="background:${course.gradientFrom}">
      <span data-icon="${course.icon}" data-icon-color="${course.iconColor}"></span>
      <div class="visual-title" style="color:${course.iconColor};">${escapeHtml(course.title)}</div>
      <p style="color:var(--color-text-sub);font-size:var(--fs-base);">${escapeHtml(course.summary)}</p>
    </div>`;
}

/**
 * 渲染课程大纲
 */
function renderSyllabus(course) {
  if (!course.syllabus || !course.syllabus.length) return '';
  return course.syllabus
    .map(
      (item, i) => `
    <div class="syllabus-item">
      <div class="syllabus-num">${i + 1}</div>
      <div class="syllabus-content">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.description)}</p>
        <div class="syllabus-duration">${escapeHtml(item.duration)}</div>
      </div>
    </div>`
    )
    .join('');
}

/**
 * 渲染讲师卡片
 */
function renderInstructor(course) {
  const inst = course.instructor;
  if (!inst) return '';
  return `
    <div class="instructor-card reveal">
      <div class="instructor-avatar" style="background:var(--color-primary)">${escapeHtml(inst.initials)}</div>
      <div class="instructor-info">
        <h3>${escapeHtml(inst.name)}</h3>
        <p class="instructor-title">${escapeHtml(inst.title)}</p>
        <p>${escapeHtml(inst.bio)}</p>
      </div>
    </div>`;
}

/**
 * 渲染报名 CTA
 */
function renderEnrollCTA(course) {
  return `
    <div class="enroll-cta reveal">
      <h2>立即开始学习</h2>
      <p>报名即享 7 天无条件退款保障</p>
      <div class="price">&yen;${course.price}</div>
      <div class="price-note">原价 &yen;${course.originalPrice} · 限时早鸟价</div>
      <a href="#" class="btn-primary" data-form="register">立即报名</a>
    </div>`;
}

/**
 * 更新页面 title 和 meta
 */
function updatePageMeta(course) {
  document.title = `${course.title} - AI学社`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', `${course.summary}. ${course.description}`);
  }
}

/**
 * 主渲染函数
 */
export async function initCourseDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    logger.error('课程详情页缺少 id 参数，跳转 404');
    window.location.replace('404.html');
    return;
  }

  const rawCourse = await dbGetCourse(id);
  const course = normalizeCourse(rawCourse);
  if (!course) {
    logger.error('未找到课程', { id });
    window.location.replace('404.html');
    return;
  }

  logger.info('渲染课程详情页', { id, title: course.title });

  updatePageMeta(course);

  const headerEl = document.getElementById('courseDetailHeader');
  if (headerEl) {
    headerEl.innerHTML = `<div class="container"><div class="course-detail-header reveal">${renderHeader(course)}</div></div>`;
  }

  const syllabusEl = document.getElementById('courseSyllabus');
  if (syllabusEl) {
    syllabusEl.innerHTML = `
      <div class="container">
        <div class="course-syllabus reveal">
          <h2>课程大纲</h2>
          ${renderSyllabus(course)}
        </div>
      </div>`;
  }

  const instructorEl = document.getElementById('courseInstructor');
  if (instructorEl) {
    instructorEl.innerHTML = `
      <div class="container">
        <div class="section-header reveal">
          <h2>主讲讲师</h2>
          <p>来自一线科技公司的 AI 实战专家</p>
        </div>
        ${renderInstructor(course)}
      </div>`;
  }

  const enrollEl = document.getElementById('courseEnroll');
  if (enrollEl) {
    enrollEl.innerHTML = `
      <div class="container">
        ${renderEnrollCTA(course)}
      </div>`;
  }

  // 渲染所有动态插入的图标
  Icons.renderAll();
}
