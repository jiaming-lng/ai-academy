/**
 * lesson.js — 课程学习页面
 * 视频播放模拟 + 章节导航 + 进度追踪 + 笔记
 */
import { getCurrentUser } from './auth.js';
import { dbGetCourse, dbGetLessons, dbSaveProgress, dbGetProgress, dbEnrollCourse } from './db.js';
import { showToast } from './toast.js';
import { escapeHtml } from './utils.js';
import { logger } from './logger.js';

let currentCourse = null;
let currentLessons = [];
let currentLessonIndex = 0;
let user = null;

document.addEventListener('DOMContentLoaded', async () => {
  user = await getCurrentUser();

  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('course');

  if (!courseId) {
    showToast('未指定课程', 'error');
    return;
  }

  try {
    currentCourse = await dbGetCourse(courseId);
    if (!currentCourse) {
      showToast('课程不存在', 'error');
      return;
    }
    currentLessons = await dbGetLessons(courseId);
  } catch (err) {
    logger.error('加载课程失败', err);
    showToast('加载课程失败', 'error');
    return;
  }

  // Breadcrumb
  document.getElementById('breadCourse').href = `course-detail.html?id=${courseId}`;
  document.getElementById('breadCourse').textContent = currentCourse.title;

  renderChapters();
  loadLesson(0);
  bindEvents();
});

// ===== 渲染章节列表 =====
function renderChapters() {
  const list = document.getElementById('chapterList');
  if (!list) return;

  list.innerHTML = currentLessons.map((lesson, i) => `
    <div class="chapter-item ${i === 0 ? 'active' : ''}" data-index="${i}">
      <span class="chapter-num">${String(i + 1).padStart(2, '0')}</span>
      <div class="chapter-info">
        <span class="chapter-title">${escapeHtml(lesson.title)}</span>
        <span class="chapter-meta">${lesson.duration_min || 10}分钟 · ${lesson.type === 'video' ? '视频' : lesson.type === 'quiz' ? '测验' : '文章'}</span>
      </div>
      <span class="chapter-check" data-icon="check" data-icon-color="#10B981" data-icon-size="16" style="display:none;"></span>
    </div>
  `).join('');

  // Load progress marks
  loadProgressMarks();
}

// ===== 加载课时 =====
async function loadLesson(index) {
  if (index < 0 || index >= currentLessons.length) return;
  currentLessonIndex = index;

  const lesson = currentLessons[index];

  document.getElementById('lessonTitle').textContent = lesson.title;
  document.getElementById('videoTitle').textContent = lesson.title;
  document.getElementById('lessonDuration').textContent = (lesson.duration_min || 10) + ' 分钟';
  document.getElementById('lessonType').textContent = lesson.type === 'video' ? '视频课程' : lesson.type === 'quiz' ? '课后测验' : '阅读文章';
  document.getElementById('breadLesson').textContent = lesson.title;

  // Video placeholder update
  const placeholder = document.querySelector('.lesson-video-placeholder');
  if (placeholder) {
    const colors = ['#6B8AFF', '#A855F7', '#10B981', '#FF6B6B', '#F59E0B', '#EC4899'];
    const bgColor = colors[index % colors.length];
    placeholder.style.background = `linear-gradient(135deg, ${bgColor}, ${bgColor}dd)`;
  }

  // Nav buttons
  document.getElementById('btnPrev').disabled = index === 0;
  document.getElementById('btnNext').style.display = index < currentLessons.length - 1 ? '' : 'none';

  // Chapter list active state
  document.querySelectorAll('.chapter-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  // Load saved progress
  loadNoteForLesson(lesson.id);
  updateCompleteButton(lesson.id);
  renderContent(lesson);

  // Auto-enroll
  if (user && currentCourse) {
    try { await dbEnrollCourse(currentCourse.id); } catch { /* already enrolled */ }
  }
}

/** 渲染课程文章内容 */
function renderContent(lesson) {
  const container = document.getElementById('lessonContent');
  if (!container) return;

  const content = lesson.content;
  if (!content || !content.sections) {
    container.innerHTML = `<div class="lesson-content-empty">
      <p>本课时暂无文字内容，请观看视频学习。</p>
    </div>`;
    return;
  }

  container.innerHTML = content.sections.map((section, i) => `
    <div class="lesson-section">
      <h2 class="lesson-section-title">${i + 1}. ${escapeHtml(section.title)}</h2>
      <div class="lesson-section-body">${renderMarkdown(section.body)}</div>
    </div>
  `).join('');
}

/** 简易 Markdown 渲染器（支持标题、粗体、列表、代码、引用） */
function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  // 代码块 ```...```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="lesson-code"><code>$2</code></pre>');
  // 行内代码 `...`
  html = html.replace(/`([^`]+)`/g, '<code class="lesson-inline-code">$1</code>');
  // 粗体 **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // 引用 > text
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="lesson-quote">$1</blockquote>');
  // 无序列表 - item
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  // 有序列表 1. item
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // 连续 <li> 包裹在 <ul> 中
  html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul class="lesson-list">$1</ul>');
  // 段落（双换行）
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  // 清理多余的空 <p>
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>(\s*<ul[\s>])/g, '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>(\s*<pre[\s>])/g, '$1');
  html = html.replace(/(<\/pre>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>(\s*<blockquote[\s>])/g, '$1');
  html = html.replace(/(<\/blockquote>)\s*<\/p>/g, '$1');
  return html;
}

// ===== 进度标记 =====
async function updateCompleteButton(lessonId) {
  const btn = document.getElementById('btnComplete');
  if (!btn) return;
  try {
    const progress = await dbGetProgress(lessonId);
    if (progress?.completed) {
      btn.innerHTML = '<span data-icon="check-circle" data-icon-color="currentColor" data-icon-size="18"></span> 已完成';
      btn.classList.add('btn-success');
    } else {
      btn.innerHTML = '<span data-icon="check-circle" data-icon-color="currentColor" data-icon-size="18"></span> 标记完成';
      btn.classList.remove('btn-success');
    }
    const { Icons } = await import('./icons.js');
    Icons.renderAll();
  } catch (err) {
    logger.warn('加载完成状态失败', err);
  }
}

async function loadProgressMarks() {
  try {
    for (let i = 0; i < currentLessons.length; i++) {
      const lesson = currentLessons[i];
      const progress = await dbGetProgress(lesson.id);
      const checkIcon = document.querySelectorAll('.chapter-check')[i];
      if (checkIcon && progress?.completed) {
        checkIcon.style.display = '';
      }
    }
  } catch (err) {
    logger.warn('加载进度标记失败', err);
  }
}

// ===== 笔记 =====
async function loadNoteForLesson(lessonId) {
  const noteInput = document.getElementById('noteInput');
  if (!noteInput) return;
  try {
    const progress = await dbGetProgress(lessonId);
    noteInput.value = progress?.notes || '';
  } catch (err) {
    logger.warn('加载笔记失败', err);
  }
}

// ===== 事件绑定 =====
function bindEvents() {
  // Chapter click
  document.getElementById('chapterList').addEventListener('click', (e) => {
    const item = e.target.closest('.chapter-item');
    if (!item) return;
    const index = parseInt(item.dataset.index);
    loadLesson(index);
  });

  // Complete button
  document.getElementById('btnComplete').addEventListener('click', async () => {
    if (!user) { showToast('请先登录', 'warning'); return; }
    const lesson = currentLessons[currentLessonIndex];
    const progress = await dbGetProgress(lesson.id);
    const completed = !(progress?.completed);
    await dbSaveProgress(lesson.id, {
      completed,
      watched_seconds: completed ? (lesson.duration_min || 10) * 60 : 0,
    });
    updateCompleteButton(lesson.id);
    loadProgressMarks();
    showToast(completed ? '已标记完成！' : '已取消完成标记', completed ? 'success' : 'info');
  });

  // Previous / Next
  document.getElementById('btnPrev').addEventListener('click', () => loadLesson(currentLessonIndex - 1));
  document.getElementById('btnNext').addEventListener('click', async () => {
    // Auto-save current progress before navigating
    const lesson = currentLessons[currentLessonIndex];
    if (user && lesson) {
      await dbSaveProgress(lesson.id, { watched_seconds: (lesson.duration_min || 10) * 60 });
    }
    loadLesson(currentLessonIndex + 1);
  });

  // Save note
  document.getElementById('btnSaveNote').addEventListener('click', async () => {
    if (!user) { showToast('请先登录', 'warning'); return; }
    const note = document.getElementById('noteInput').value.trim();
    const lesson = currentLessons[currentLessonIndex];
    await dbSaveProgress(lesson.id, { notes: note });
    showToast('笔记已保存', 'success');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && !e.shiftKey) {
      if (currentLessonIndex < currentLessons.length - 1) loadLesson(currentLessonIndex + 1);
    } else if (e.key === 'ArrowLeft' && !e.shiftKey) {
      if (currentLessonIndex > 0) loadLesson(currentLessonIndex - 1);
    }
  });
}
