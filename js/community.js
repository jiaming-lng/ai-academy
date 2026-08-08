// ============================================================
// community.js — 动态社区系统
// 发帖 / 评论 / 点赞 / 分页 / 标签筛选
// 数据层通过 db.js 统一接入（Supabase / localStorage 双模式）
// ============================================================

import { logger } from './logger.js';
import { escapeHtml } from './utils.js';
import { showToast } from './toast.js';
import { isLoggedIn } from './auth.js';
import {
  dbGetPosts,
  dbCreatePost,
  dbGetComments,
  dbCreateComment,
  dbToggleLike,
} from './db.js';

// ============================================================
// 状态
// ============================================================
let currentPage = 1;
let currentTag = '';
const PAGE_SIZE = 10;

// 内置标签
const ALL_TAGS = ['全部', '提问', '分享', '项目', '讨论', '教程', '工具'];

// ============================================================
// 初始化
// ============================================================
export async function initCommunity() {
  renderTagBar();
  await loadPosts();
  bindGlobalEvents();
  logger.info('社区模块初始化完成');
}

// ============================================================
// 标签栏
// ============================================================
function renderTagBar() {
  const container = document.getElementById('communityTagBar');
  if (!container) return;

  container.innerHTML = ALL_TAGS.map(tag => {
    const isActive = (tag === '全部' && currentTag === '') || currentTag === tag;
    return `<button class="tag-chip${isActive ? ' active' : ''}" data-tag="${tag === '全部' ? '' : tag}">${tag}</button>`;
  }).join('');

  container.querySelectorAll('.tag-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTag = btn.dataset.tag;
      currentPage = 1;
      renderTagBar();
      loadPosts();
    });
  });
}

// ============================================================
// 加载帖子列表
// ============================================================
async function loadPosts() {
  const listEl = document.getElementById('communityPostList');
  if (!listEl) return;

  listEl.innerHTML = renderSkeletons(3);

  try {
    const posts = await dbGetPosts(currentPage, PAGE_SIZE, currentTag);
    if (posts.length === 0) {
      listEl.innerHTML = `<div class="empty-state">
        <span class="empty-icon" data-icon="message-square" style="font-size:48px;opacity:0.3;"></span>
        <p>暂无帖子，来发第一个吧！</p>
        ${isLoggedIn() ? '' : '<p style="font-size:14px;color:var(--color-muted)">登录后即可发帖</p>'}
      </div>`;
    } else {
      listEl.innerHTML = posts.map(post => renderPostCard(post)).join('');
      bindPostCardEvents();
    }
  } catch (err) {
    logger.error('加载帖子失败', err);
    listEl.innerHTML = `<div class="empty-state"><p>加载失败，请刷新重试</p></div>`;
  }

  renderPagination();
}

function renderSkeletons(count) {
  return Array.from({ length: count }, () => `
    <div class="post-card skeleton">
      <div class="skeleton-line w-60"></div>
      <div class="skeleton-line w-full"></div>
      <div class="skeleton-line w-80"></div>
      <div class="skeleton-line w-40"></div>
    </div>
  `).join('');
}

function renderPostCard(post) {
  const tags = (post.tags || []).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('');
  const authorName = escapeHtml(post.profiles?.full_name || post.profiles?.username || '匿名');
  const timeAgo = formatTimeAgo(post.created_at);
  const title = escapeHtml(post.title);
  const excerpt = escapeHtml((post.content || '').slice(0, 200) + ((post.content || '').length > 200 ? '...' : ''));

  return `
    <article class="post-card" data-post-id="${post.id}">
      <div class="post-header">
        <div class="post-author">
          <div class="avatar-placeholder">${authorName[0]}</div>
          <span class="post-author-name">${authorName}</span>
          <span class="post-time">${timeAgo}</span>
        </div>
        <div class="post-tags">${tags}</div>
      </div>
      <h3 class="post-title">${title}</h3>
      <p class="post-excerpt">${excerpt}</p>
      <div class="post-actions">
        <button class="btn-like" data-post-id="${post.id}" data-action="like">
          <span data-icon="heart" style="width:16px;height:16px;"></span>
          <span class="like-count">${post.likes_count || 0}</span>
        </button>
        <button class="btn-comment" data-post-id="${post.id}" data-action="comment">
          <span data-icon="message-circle" style="width:16px;height:16px;"></span>
          <span>${post.comments_count || 0} 回复</span>
        </button>
      </div>
    </article>
  `;
}

function bindPostCardEvents() {
  document.querySelectorAll('.post-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // 不拦截按钮点击
      if (e.target.closest('button')) return;
      const postId = card.dataset.postId;
      if (postId) openPostDetail(postId);
    });
  });

  document.querySelectorAll('.btn-like').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!requireLogin()) return;
      const postId = btn.dataset.postId;
      try {
        const result = await dbToggleLike('post', postId);
        const countEl = btn.querySelector('.like-count');
        if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) + (result.liked ? 1 : -1));
        btn.classList.toggle('liked', result.liked);
        showToast(result.liked ? '已点赞' : '已取消点赞', 'success');
      } catch (err) {
        showToast('操作失败：' + err.message, 'error');
      }
    });
  });

  document.querySelectorAll('.btn-comment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const postId = btn.dataset.postId;
      if (postId) openPostDetail(postId);
    });
  });
}

// ============================================================
// 帖子详情（弹窗）
// ============================================================
async function openPostDetail(postId) {
  const modal = document.getElementById('postDetailModal');
  if (!modal) return;

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const body = modal.querySelector('.modal-body');
  if (body) body.innerHTML = `<div class="skeleton-line w-full" style="height:80px;"></div><div class="skeleton-line w-60"></div>`;

  try {
    const posts = await dbGetPosts(1, 100, '');
    const post = posts.find(p => p.id === postId);
    if (!post) throw new Error('帖子不存在');

    const comments = await dbGetComments(postId);

    body.innerHTML = `
      <div class="detail-post">
        <div class="detail-post-author">
          <div class="avatar-placeholder">${(post.profiles?.full_name || post.profiles?.username || '匿')[0]}</div>
          <div>
            <div class="detail-author-name">${escapeHtml(post.profiles?.full_name || post.profiles?.username || '匿名')}</div>
            <div class="detail-time">${formatTimeAgo(post.created_at)}</div>
          </div>
        </div>
        <h2 class="detail-title">${escapeHtml(post.title)}</h2>
        <div class="detail-content">${escapeHtml(post.content || '')}</div>
        <div class="detail-tags">${(post.tags || []).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
      <div class="comments-section">
        <h4>回复 (${comments.length})</h4>
        <div class="comments-list">
          ${comments.length === 0
            ? '<p class="empty-comments">暂无回复，来说点什么吧</p>'
            : comments.map(c => `
              <div class="comment-item">
                <div class="comment-avatar">${(c.profiles?.full_name || c.profiles?.username || '匿')[0]}</div>
                <div class="comment-body">
                  <div class="comment-author">${escapeHtml(c.profiles?.full_name || c.profiles?.username || '匿名')} <span class="comment-time">${formatTimeAgo(c.created_at)}</span></div>
                  <p>${escapeHtml(c.content)}</p>
                </div>
              </div>
            `).join('')}
        </div>
        ${isLoggedIn() ? `
          <div class="comment-form">
            <textarea id="commentInput" rows="3" placeholder="写下你的回复..." maxlength="1000"></textarea>
            <button id="submitComment" class="btn-primary">发表回复</button>
          </div>
        ` : `<p class="login-prompt">请<a href="#" id="commentLoginLink">登录</a>后参与讨论</p>`}
      </div>
    `;

    // 绑定评论提交
    const submitBtn = document.getElementById('submitComment');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => submitComment(postId));
    }
    // 登录链接
    const loginLink = document.getElementById('commentLoginLink');
    if (loginLink) {
      loginLink.addEventListener('click', (e) => {
        e.preventDefault();
        closePostDetail();
        // 触发登录弹窗（由 forms.js 提供全局 openModal）
        if (typeof window.openModal === 'function') {
          window.openModal('login');
        }
      });
    }
  } catch (err) {
    if (body) body.innerHTML = `<div class="empty-state"><p>加载失败：${escapeHtml(err.message)}</p></div>`;
  }
}

function closePostDetail() {
  const modal = document.getElementById('postDetailModal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

async function submitComment(postId) {
  const input = document.getElementById('commentInput');
  if (!input) return;
  const content = input.value.trim();
  if (!content) { showToast('请输入回复内容', 'warning'); return; }

  try {
    await dbCreateComment(postId, content);
    showToast('回复已发表', 'success');
    input.value = '';
    await openPostDetail(postId); // 刷新
  } catch (err) {
    showToast('回复失败：' + err.message, 'error');
  }
}

// ============================================================
// 发帖
// ============================================================
function openNewPostForm() {
  if (!requireLogin()) return;

  const modal = document.getElementById('newPostModal');
  if (!modal) return;

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  modal.querySelector('.modal-body').innerHTML = `
    <div class="new-post-form">
      <label for="newPostTitle">标题</label>
      <input type="text" id="newPostTitle" placeholder="一句话描述你的问题或想法" maxlength="200" required>
      <label for="newPostContent">内容</label>
      <textarea id="newPostContent" rows="6" placeholder="详细描述..." maxlength="5000"></textarea>
      <label>标签</label>
      <div class="tag-selector" id="tagSelector">
        ${ALL_TAGS.filter(t => t !== '全部').map(t => `
          <label class="tag-checkbox"><input type="checkbox" value="${t}"> ${t}</label>
        `).join('')}
      </div>
      <button id="publishPost" class="btn-primary" style="margin-top:16px;width:100%;">发布帖子</button>
    </div>
  `;

  document.getElementById('publishPost').addEventListener('click', publishPost);
}

async function publishPost() {
  const title = document.getElementById('newPostTitle').value.trim();
  const content = document.getElementById('newPostContent').value.trim();
  if (!title) { showToast('请输入标题', 'warning'); return; }
  if (!content) { showToast('请输入内容', 'warning'); return; }

  const tagEls = document.querySelectorAll('#tagSelector input:checked');
  const tags = Array.from(tagEls).map(el => el.value);

  try {
    await dbCreatePost(title, content, tags);
    showToast('帖子发布成功！', 'success');
    closeNewPostForm();
    currentPage = 1;
    currentTag = '';
    renderTagBar();
    await loadPosts();
  } catch (err) {
    showToast('发布失败：' + err.message, 'error');
  }
}

function closeNewPostForm() {
  const modal = document.getElementById('newPostModal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// ============================================================
// 分页
// ============================================================
function renderPagination() {
  const el = document.getElementById('communityPagination');
  if (!el) return;

  // 简化版：上一页/下一页
  el.innerHTML = `
    <button class="btn-page" id="prevPage" ${currentPage <= 1 ? 'disabled' : ''}>
      <span data-icon="chevron-left" style="width:16px;height:16px;"></span> 上一页
    </button>
    <span class="page-indicator">第 ${currentPage} 页</span>
    <button class="btn-page" id="nextPage">下一页 <span data-icon="chevron-right" style="width:16px;height:16px;"></span></button>
  `;

  document.getElementById('prevPage')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; loadPosts(); window.scrollTo({ top: 500, behavior: 'smooth' }); }
  });
  document.getElementById('nextPage')?.addEventListener('click', () => {
    currentPage++; loadPosts(); window.scrollTo({ top: 500, behavior: 'smooth' });
  });
}

// ============================================================
// 全局事件
// ============================================================
function bindGlobalEvents() {
  // 发帖按钮
  document.getElementById('btnNewPost')?.addEventListener('click', openNewPostForm);

  // 发帖弹窗关闭
  document.getElementById('closeNewPostModal')?.addEventListener('click', closeNewPostForm);
  document.getElementById('newPostModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeNewPostForm();
  });

  // 帖子详情弹窗关闭
  document.getElementById('closePostDetailModal')?.addEventListener('click', closePostDetail);
  document.getElementById('postDetailModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePostDetail();
  });

  // ESC 关闭弹窗
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeNewPostForm();
      closePostDetail();
    }
  });
}

// ============================================================
// 登录检查
// ============================================================
function requireLogin() {
  if (!isLoggedIn()) {
    showToast('请先登录后再操作', 'warning');
    if (typeof window.openModal === 'function') {
      window.openModal('login');
    }
    return false;
  }
  return true;
}

// ============================================================
// 工具
// ============================================================
function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  if (diff < 2592000) return Math.floor(diff / 86400) + ' 天前';
  return date.toLocaleDateString('zh-CN');
}
