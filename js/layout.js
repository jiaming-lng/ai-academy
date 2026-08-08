/* ============================================================
   layout.js — 共享布局注入器 (ES Module)
   自动注入 Header + Mobile Nav + Footer + Back-to-top + Skip Link
   配置来自 js/config/site.config.js；异常时降级渲染，避免白屏
   ============================================================ */

import { Icons } from './icons.js';
import { siteConfig } from './config/site.config.js';
import { logger } from './logger.js';
import { getCurrentUser, logout } from './auth.js';

const { nav, footer, brand, themeKey } = siteConfig;

const body = document.body;
const currentPage = body.getAttribute('data-page') || 'index.html';

// ===== Build Header =====
function buildHeader() {
  const navItems = nav
    .map((link) => {
      const active = link.href === currentPage ? ' class="active" aria-current="page"' : '';
      return `<a href="${link.href}"${active}>${link.label}</a>`;
    })
    .join('');

  return `
  <!-- Header -->
  <header class="header" role="banner">
    <div class="container">
      <a href="index.html" class="header-logo">${brand.name}</a>
      <nav class="header-nav" role="navigation" aria-label="主导航">
        ${navItems}
      </nav>
      <div class="header-auth-btns" id="headerAuthBtns">
        <a href="#" data-form="login" class="btn-text">登录</a>
        <a href="#" data-form="register" class="btn-primary-sm">注册</a>
      </div>
      <button class="theme-toggle" aria-label="切换主题" id="themeToggle">
        <span class="icon-moon">${Icons.get('moon', '#6B6B8A')}</span>
        <span class="icon-sun">${Icons.get('sun', '#FFCB47')}</span>
      </button>
      <button class="hamburger" aria-label="打开菜单" aria-expanded="false" aria-controls="mobileNav">
        <span></span><span></span><span></span>
      </button>
      <span class="header-auth" id="headerAuth" style="display:none;">
        <span class="header-user-icon" data-icon="user" data-icon-color="#6B8AFF"></span>
        <span class="header-user-name" id="headerUserName"></span>
        <button class="header-logout-btn" id="headerLogout" title="退出登录" aria-label="退出登录">退出</button>
      </span>
    </div>
  </header>

  <!-- Mobile Nav -->
  <nav class="mobile-nav" id="mobileNav" role="navigation" aria-label="移动端导航">
    ${nav
      .map((link) => {
        const active = link.href === currentPage ? ' class="active" aria-current="page"' : '';
        return `<a href="${link.href}"${active}>${link.label}</a>`;
      })
      .join('\n    ')}
    <button class="mobile-nav-close" id="mobileNavClose" aria-label="关闭菜单">${Icons.get('close', '#6B6B8A')}</button>
  </nav>
`;
}

// ===== Build Newsletter =====
function buildNewsletter() {
  return `
  <!-- Newsletter -->
  <section class="newsletter" aria-label="订阅资讯">
    <div class="container">
      <div class="newsletter-content reveal">
        <h3>获取最新 AI 学习资讯</h3>
        <p>每周精选 AI 领域前沿动态和课程更新，不错过每一次成长机会</p>
        <form class="newsletter-form" id="newsletterForm" novalidate>
          <div class="newsletter-input-group">
            <input
              type="email"
              name="newsletter-email"
              class="newsletter-input"
              placeholder="输入你的邮箱地址"
              aria-label="邮箱地址"
              required
              autocomplete="email"
            >
            <button type="submit" class="btn-primary newsletter-submit">
              <span data-icon="send" data-icon-color="#fff"></span>
              <span>订阅</span>
            </button>
          </div>
          <p class="newsletter-note">不发送垃圾邮件，可随时退订</p>
        </form>
      </div>
    </div>
  </section>
`;
}

// ===== Build Footer =====
function buildFooter() {
  const colsHtml = footer
    .map((col) => {
      const links = col.links
        .map((link) => `<a href="${link.href}">${link.label}</a>`)
        .join('\n          ');
      return `<div class="footer-col">
          <div class="col-title">${col.title}</div>
          ${links}
        </div>`;
    })
    .join('\n        ');

  return `
  <!-- Footer -->
  <footer class="footer" role="contentinfo">
    <div class="container">
      <div class="footer-top">
        <div class="footer-brand">
          <div class="logo">${brand.name}</div>
          <p class="tagline">${brand.tagline}</p>
        </div>
        ${colsHtml}
      </div>
      <div class="footer-divider"></div>
      <div class="footer-bottom">
        <span class="copyright">${brand.copyright}</span>
        <div class="footer-legal">
          <a href="about.html#privacy">隐私政策</a>
          <a href="about.html#terms">服务条款</a>
        </div>
      </div>
    </div>
  </footer>
`;
}

// ===== Build Back-to-top =====
function buildBackToTop() {
  return `
  <!-- Scroll Progress -->
  <div class="scroll-progress" id="scrollProgress" role="progressbar" aria-label="页面阅读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>
  <!-- Back to Top -->
  <button class="back-to-top" aria-label="返回顶部">
    ${Icons.get('arrow-up', '#fff')}
  </button>
`;
}

// ===== Build Skip Link =====
function buildSkipLink() {
  return '<a href="#main-content" class="skip-link">跳到主要内容</a>\n';
}

// ===== Inject Layout =====
function injectLayout() {
  body.insertAdjacentHTML('afterbegin', buildSkipLink());

  let main = document.querySelector('main');
  if (!main) {
    main = document.createElement('main');
    main.id = 'main-content';
    while (body.children.length > 1) {
      main.appendChild(body.children[1]);
    }
    body.appendChild(main);
  }
  main.id = main.id || 'main-content';

  main.insertAdjacentHTML('beforebegin', buildHeader());
  main.insertAdjacentHTML('afterend', buildNewsletter());
  main.insertAdjacentHTML('afterend', buildFooter());
  main.insertAdjacentHTML('afterend', buildBackToTop());
}

// ===== Theme Toggle (三态: light → dark → auto → light) =====
let systemDarkQuery = null;
function applyTheme(mode) {
  const html = document.documentElement;
  if (mode === 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else if (mode === 'light') {
    html.removeAttribute('data-theme');
  } else {
    // auto: follow system
    if (systemDarkQuery && systemDarkQuery.matches) {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.removeAttribute('data-theme');
    }
  }
  localStorage.setItem(themeKey, mode);
}

function updateToggleIcon(toggle, mode) {
  const moon = toggle.querySelector('.icon-moon');
  const sun = toggle.querySelector('.icon-sun');
  if (!moon || !sun) return;
  if (mode === 'auto') {
    moon.style.display = 'none';
    sun.style.display = 'none';
    toggle.setAttribute('aria-label', '主题: 跟随系统 (点击切换)');
    toggle.innerHTML = '<span class="icon-auto" style="display:inline-flex;width:20px;height:20px">' + Icons.get('sun-moon', '#6B8AFF') + '</span>';
  } else {
    moon.style.display = mode === 'dark' ? 'none' : 'block';
    sun.style.display = mode === 'dark' ? 'block' : 'none';
    toggle.setAttribute('aria-label', '切换主题 (当前: ' + (mode === 'dark' ? '暗色' : '亮色') + ')');
  }
}

function initTheme() {
  const saved = localStorage.getItem(themeKey) || 'light';
  const THEMES = ['light', 'dark', 'auto'];
  let current = THEMES.includes(saved) ? saved : 'light';

  // 监听系统主题
  systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  applyTheme(current);

  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    updateToggleIcon(toggle, current);

    toggle.addEventListener('click', function () {
      const idx = THEMES.indexOf(current);
      current = THEMES[(idx + 1) % THEMES.length];
      applyTheme(current);
      updateToggleIcon(toggle, current);
    });
  }

  // auto 模式实时响应系统主题变化
  systemDarkQuery.addEventListener('change', function () {
    if (current === 'auto') applyTheme('auto');
  });
}

// ===== 降级渲染：注入失败时保留可导航的 Header =====
function renderFallbackHeader() {
  body.insertAdjacentHTML(
    'afterbegin',
    `<header class="header"><div class="container"><a href="index.html" class="header-logo">${brand.name}</a></div></header>`
  );
}

// ===== Auth UI =====
async function updateAuthUI() {
  const authBtnsEl = document.getElementById('headerAuthBtns');
  const authEl = document.getElementById('headerAuth');
  const nameEl = document.getElementById('headerUserName');
  const logoutBtn = document.getElementById('headerLogout');

  if (!authBtnsEl || !authEl) return;

  const user = await getCurrentUser();

  if (user) {
    authBtnsEl.style.display = 'none';
    authEl.style.display = '';
    if (nameEl) nameEl.textContent = user.name;
    if (logoutBtn) {
      logoutBtn.onclick = async function () {
        await logout();
        updateAuthUI();
      };
    }
  } else {
    authBtnsEl.style.display = '';
    authEl.style.display = 'none';
  }
}

// ===== 移动端导航：点击链接后自动关闭 =====
function setupMobileNavAutoClose() {
  const mobileNav = document.getElementById('mobileNav');
  if (!mobileNav) return;
  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
      const hamburger = document.querySelector('.hamburger');
      if (hamburger) {
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.classList.remove('active');
      }
    });
  });
}

// ===== Run =====
function init() {
  try {
    injectLayout();
    Icons.renderAll();
    initTheme();
    updateAuthUI();
    setupMobileNavAutoClose();
    // 移动端导航关闭按钮
  const mobileNavClose = document.getElementById('mobileNavClose');
  if (mobileNavClose) {
    mobileNavClose.addEventListener('click', function () {
      const mobileNav = document.getElementById('mobileNav');
      const hamburger = document.querySelector('.hamburger');
      if (mobileNav) {
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
      }
      if (hamburger) {
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.classList.remove('active');
      }
    });
  }

  window.__layoutReady = true;
    window.__updateAuthUI = updateAuthUI;
    logger.info('布局注入完成:', currentPage);
  } catch (err) {
    logger.error('布局注入失败，已降级渲染', err);
    renderFallbackHeader();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
