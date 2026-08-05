// ============================================================
// courses.js — 课程列表动态渲染 + 搜索筛选 (Phase 4)
// 替换 courses.html 中硬编码的课程卡片
// 依赖: courses.data.js, icons.js, logger.js
// ============================================================

import { courses } from './config/courses.data.js';
import { Icons } from './icons.js';
import { logger } from './logger.js';
import { escapeHtml } from './utils.js';

/**
 * 创建单个课程卡片 HTML
 */
function createCourseCard(course) {
  const { id, title, difficultyLabel, weeks, lessons, icon, iconColor, gradientFrom, gradientTo, summary } = course;

  return `
    <div class="course-card reveal" data-course-id="${id}" data-difficulty="${course.difficulty}">
      <a href="course-detail.html?id=${encodeURIComponent(id)}" class="course-card-image" style="background: linear-gradient(135deg, ${gradientFrom}, ${gradientTo});">
        <span data-icon="${icon}" data-icon-color="${iconColor}"></span>
      </a>
      <div class="course-card-body">
        <div class="course-card-meta">
          <span class="difficulty ${course.difficulty}">${difficultyLabel}</span>
          <span>${weeks} 周 · ${lessons} 课时</span>
        </div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(summary)}</p>
        <a href="course-detail.html?id=${encodeURIComponent(id)}" class="btn-sm">开始学习</a>
      </div>
    </div>`;
}

/**
 * 创建空状态 HTML
 */
function createEmptyState() {
  return `
    <div class="empty-state">
      <span class="empty-icon" data-icon="database" data-icon-color="#999" style="display:inline-flex;width:64px;height:64px;"></span>
      <h3>没有找到匹配的课程</h3>
      <p>试试调整搜索关键词或筛选条件</p>
    </div>`;
}

/**
 * 渲染所有课程卡片
 */
function renderCourses(filter = 'all', keyword = '') {
  const grid = document.getElementById('coursesGrid');
  if (!grid) return;

  let filtered = courses;

  if (filter !== 'all') {
    filtered = filtered.filter((c) => c.difficulty === filter);
  }

  if (keyword.trim()) {
    const kw = keyword.trim().toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.title.toLowerCase().includes(kw) ||
        c.summary.toLowerCase().includes(kw) ||
        c.difficultyLabel.includes(kw)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = createEmptyState();
    // 渲染空状态图标
    Icons.renderAll();
    return;
  }

  grid.innerHTML = filtered.map(createCourseCard).join('');
  Icons.renderAll();

  // 统计
  const totalEl = document.getElementById('courseCount');
  if (totalEl) {
    totalEl.textContent = `共 ${filtered.length} 门课程`;
  }
}

/**
 * 设置搜索和筛选事件
 */
function setupSearchAndFilter() {
  const searchInput = document.getElementById('courseSearch');
  const clearBtn = document.getElementById('clearSearch');
  const filterBtns = document.querySelectorAll('.filter-btn');

  let currentFilter = 'all';

  if (!searchInput) return;

  function applyFilters() {
    const keyword = searchInput.value;
    clearBtn.style.display = keyword ? 'block' : 'none';
    renderCourses(currentFilter, keyword);
  }

  searchInput.addEventListener('input', applyFilters);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      renderCourses(currentFilter, '');
      searchInput.focus();
    });
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyFilters();
    });
  });

  // 初始渲染图标
  Icons.renderAll();
}

export function initCoursesPage() {
  logger.info('初始化课程列表页');
  renderCourses();
  setupSearchAndFilter();
}
