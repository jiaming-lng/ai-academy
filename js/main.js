/* ============================================================
   main.js — 页面交互 (ES Module)
   汉堡菜单 / 平滑滚动 / 返回顶部 / 滚动渐入 / 数字动画 / 导航高亮
   + CTA 表单拦截 / 焦点陷阱 / 全局错误兜底 / 分级日志
   依赖: layout.js 注入的共享布局 (window.__layoutReady)
   ============================================================ */

import { logger } from './logger.js';
import { openForm } from './forms.js';
import { showToast } from './toast.js';
import { initHeroParticles } from './hero-particles.js';

// Sentry 可选：未安装 @sentry/browser 时静默降级
let reportError = () => {};
let setGlobalTag = () => {};
// 异步加载 sentry，不阻塞页面渲染
import('./sentry.js')
  .then((sentry) => {
    reportError = sentry.reportError;
    setGlobalTag = sentry.setGlobalTag;
    // 加载成功后立即标记当前页面
    try {
      const pagePath = location.pathname.replace(/\/$/, '') || '/';
      setGlobalTag('page', pagePath);
    } catch { /* noop */ }
  })
  .catch(() => {
    // sentry 不可用，静默降级
  });

// ===== 全局错误兜底 =====
function showErrorBanner(message) {
  let banner = document.getElementById('global-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'global-error-banner';
    banner.setAttribute('role', 'alert');
    banner.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#E5484D;color:#fff;font-size:13px;padding:10px 16px;text-align:center;box-shadow:0 -2px 8px rgba(0,0,0,.2)';
    document.body.appendChild(banner);
  }
  banner.textContent = message;
  setTimeout(() => {
    if (banner.parentNode) banner.parentNode.removeChild(banner);
  }, 6000);
}

window.addEventListener('error', (e) => {
  logger.error('全局运行时错误:', e.message, e.error);
  reportError(e.error || e.message, { type: 'runtime', filename: e.filename, lineno: e.lineno });
  showErrorBanner('页面出现了一点问题，但核心内容仍可浏览。');
});

window.addEventListener('unhandledrejection', (e) => {
  logger.error('未捕获的 Promise 异常:', e.reason);
  reportError(e.reason || 'Unhandled Promise Rejection', { type: 'unhandledrejection' });
  showErrorBanner('检测到异步错误，部分功能可能受限。');
});

// ===== 等待布局注入完成 =====
function onReady(fn) {
  if (window.__layoutReady) {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

onReady(function () {
  // ===== 1. Mobile Hamburger Menu (with focus trap) =====
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.getElementById('mobileNav');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', function () {
      const isOpen = mobileNav.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.style.overflow = isOpen ? 'hidden' : '';
      if (isOpen) trapFocusIn(mobileNav, hamburger);
    });

    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        closeMobileNav();
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
        closeMobileNav();
      }
    });
  }

  function closeMobileNav() {
    if (!mobileNav.classList.contains('open')) return;
    mobileNav.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    hamburger.focus();
  }

  /** Focus trap: Tab/Shift+Tab 在 mobileNav 内循环 */
  function trapFocusIn(container, _trigger) {
    const focusable = container.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    function onKey(e) {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    }
    container.addEventListener('keydown', onKey);
    container._focusTrapCleanup = function () {
      container.removeEventListener('keydown', onKey);
    };
    setTimeout(function () { first.focus(); }, 100);
  }

  // ===== 2. Smooth Scroll =====
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '#main-content') {
        if (targetId === '#main-content') {
          e.preventDefault();
          document.getElementById('main-content').focus();
        }
        return;
      }
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // 拦截纯 # 空链接触发 Toast（隐私政策/服务条款等）
  document.addEventListener('click', function (e) {
    const link = e.target.closest('a[href="#"]');
    if (link && !link.hasAttribute('data-form')) {
      e.preventDefault();
      showToast('页面建设中，敬请期待！', 'info', 2500);
    }
  });

  // ===== 3. Active Nav Highlight =====
  (function setActiveNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.header-nav a, .mobile-nav a');

    navLinks.forEach(function (link) {
      const href = link.getAttribute('href');
      if (
        (currentPath === 'index.html' && (href === 'index.html' || href === './')) ||
        (href && href !== '#' && currentPath === href)
      ) {
        link.classList.add('active');
      }
    });
  })();

  // ===== 4. Scroll Reveal =====
  const revealElements = document.querySelectorAll('.reveal');
  if (revealElements.length > 0 && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    revealElements.forEach(function (el) { revealObserver.observe(el); });
  }

  // ===== 5. Back to Top + Scroll Progress =====
  const backToTop = document.querySelector('.back-to-top');
  const scrollProgress = document.getElementById('scrollProgress');
  if (backToTop || scrollProgress) {
    let ticking = false;

    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          const scrollTop = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const progress = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;

          if (backToTop) {
            if (scrollTop > 500) {
              backToTop.classList.add('visible');
            } else {
              backToTop.classList.remove('visible');
            }
          }
          if (scrollProgress) {
            scrollProgress.style.width = progress + '%';
            scrollProgress.setAttribute('aria-valuenow', Math.round(progress));
          }
          ticking = false;
        });
        ticking = true;
      }
    });

    if (backToTop) {
      backToTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  // ===== 6. Stat Counter Animation =====
  const statNumbers = document.querySelectorAll('.stat-number[data-target]');
  if (statNumbers.length > 0 && 'IntersectionObserver' in window) {
    const hasAnimated = {};

    function animateCounter(el) {
      const target = parseInt(el.getAttribute('data-target'), 10);
      const suffix = el.getAttribute('data-suffix') || '';
      const duration = 2000;
      let startTime = null;

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        el.textContent = current.toLocaleString() + suffix;
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = target.toLocaleString() + suffix;
        }
      }
      requestAnimationFrame(step);
    }

    const counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !hasAnimated[entry.target.dataset.target]) {
          hasAnimated[entry.target.dataset.target] = true;
          animateCounter(entry.target);
        }
      });
    }, { threshold: 0.5 });

    statNumbers.forEach(function (el) { counterObserver.observe(el); });
  }

  // ===== 7. CTA / Form 拦截 =====
  // [data-form] 元素 → 打开对应表单
  document.querySelectorAll('[data-form]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openForm(el.getAttribute('data-form'), el);
    });
  });

  // #enroll / #contact / #register / #login 锚点 → 表单
  const formAnchorMap = { '#enroll': 'register', '#contact': 'contact', '#register': 'register', '#login': 'login' };
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    const href = anchor.getAttribute('href');
    const formType = formAnchorMap[href];
    if (formType) {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        openForm(formType, anchor);
      });
    }
  });

  // 社区页"立即加入社区" CTA 按钮 → 注册表单
  const communityBtn = document.querySelector('.community-cta .btn-primary');
  if (communityBtn) {
    communityBtn.addEventListener('click', function (e) {
      e.preventDefault();
      openForm('register', communityBtn);
    });
  }

  logger.info('页面交互初始化完成');

  // ===== 8. Newsletter Form =====
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const input = newsletterForm.querySelector('[name="newsletter-email"]');
      const email = input ? input.value.trim() : '';
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('请输入有效的邮箱地址', 'error', 3000);
        return;
      }
      // 模拟订阅（后续可接入真实 API）
      showToast('订阅成功！感谢你的关注 🎉', 'success', 4000);
      newsletterForm.reset();
    });
  }

  // ===== 9. Hero Particles =====
  initHeroParticles();

  // ===== 10. Service Worker =====
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});
