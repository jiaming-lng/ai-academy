/* ============================================================
   forms.js — 表单管理器 (ES Module)
   支持 注册 / 登录 / 联系 三种表单类型
   前端校验 → 模拟提交 → Toast 反馈
   ============================================================ */

import { showToast } from './toast.js';
import { logger } from './logger.js';
import { register as authRegister, login as authLogin, resetPassword as authResetPassword, signInWithOAuth as authSignInWithOAuth } from './auth.js';

const MODAL_ID = 'form-modal';
const OVERLAY_ID = 'form-overlay';

// 模块级状态（避免污染 window）
let _formTriggerEl = null;
let _formModalEscHandler = null;

// ===== 校验规则 =====
const validators = {
  required(value) {
    return value && value.trim().length > 0 ? '' : '此项为必填';
  },
  email(value) {
    if (!value) return '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : '请输入有效的邮箱地址';
  },
  minLength(min) {
    return (value) => {
      if (!value) return '';
      return value.length >= min ? '' : `至少需要 ${min} 个字符`;
    };
  },
  password(value) {
    if (!value) return '';
    if (value.length < 8) return '密码至少需要 8 个字符';
    if (!/[A-Za-z]/.test(value)) return '密码需包含字母';
    if (!/[0-9]/.test(value)) return '密码需包含数字';
    return '';
  },
  match(targetValue) {
    return (value) => (value === targetValue ? '' : '两次输入的密码不一致');
  },
};

// ===== 表单定义 =====
const formDefs = {
  register: {
    title: '创建账号',
    fields: [
      { name: 'name', label: '用户名', type: 'text', placeholder: '请输入用户名', rules: ['required'], autocomplete: 'name' },
      { name: 'email', label: '邮箱', type: 'email', placeholder: '请输入邮箱地址', rules: ['required', 'email'], autocomplete: 'email' },
      { name: 'password', label: '密码', type: 'password', placeholder: '至少8位，包含字母和数字', rules: ['required', 'password'], autocomplete: 'new-password' },
      { name: 'confirmPassword', label: '确认密码', type: 'password', placeholder: '再次输入密码', rules: ['required', 'match:password'], autocomplete: 'new-password' },
    ],
    submitLabel: '注册',
    footer: '已有账号？<a href="#" data-form="login">立即登录</a>',
    hasOAuth: true,
    async onSubmit(data) {
      const result = await authRegister({ name: data.name, email: data.email, password: data.password });
      if (result.success) {
        if (result.needsVerification) {
          return result; // 表单内展示验证提示
        }
        if (window.__updateAuthUI) window.__updateAuthUI();
      }
      return result;
    },
  },

  login: {
    title: '登录账号',
    fields: [
      { name: 'email', label: '邮箱', type: 'email', placeholder: '请输入邮箱地址', rules: ['required', 'email'], autocomplete: 'email' },
      { name: 'password', label: '密码', type: 'password', placeholder: '请输入密码', rules: ['required'], autocomplete: 'current-password' },
    ],
    submitLabel: '登录',
    footer: '还没有账号？<a href="#" data-form="register">立即注册</a><br><a href="#" data-form="forgot-password" style="font-size:13px;color:var(--color-muted);">忘记密码？</a>',
    hasOAuth: true,
    async onSubmit(data) {
      const result = await authLogin({ email: data.email, password: data.password });
      if (result.success && window.__updateAuthUI) {
        window.__updateAuthUI();
      }
      return result;
    },
  },

  'forgot-password': {
    title: '找回密码',
    fields: [
      { name: 'email', label: '注册邮箱', type: 'email', placeholder: '请输入注册时使用的邮箱', rules: ['required', 'email'], autocomplete: 'email' },
    ],
    submitLabel: '发送重置链接',
    footer: '<a href="#" data-form="login">返回登录</a>',
    hasOAuth: false,
    async onSubmit(data) {
      const result = await authResetPassword(data.email);
      return result;
    },
  },

  contact: {
    title: '联系我们',
    fields: [
      { name: 'name', label: '姓名', type: 'text', placeholder: '请输入您的姓名', rules: ['required'], autocomplete: 'name' },
      { name: 'email', label: '邮箱', type: 'email', placeholder: '请输入邮箱地址', rules: ['required', 'email'], autocomplete: 'email' },
      { name: 'subject', label: '主题', type: 'text', placeholder: '请输入主题', rules: ['required'] },
      { name: 'message', label: '留言内容', type: 'textarea', placeholder: '请输入您想说的话...', rows: 4, rules: ['required'] },
    ],
    submitLabel: '发送',
    async onSubmit(data) {
      // 存储联系消息到 localStorage（demo 用途）
      try {
        const messages = JSON.parse(localStorage.getItem('ai-xueshe-messages') || '[]');
        messages.push({ ...data, timestamp: new Date().toISOString() });
        localStorage.setItem('ai-xueshe-messages', JSON.stringify(messages));
        logger.info('联系消息已保存', { subject: data.subject });
      } catch {
        logger.warn('联系消息保存失败');
      }
      return { success: true, message: '消息已发送，我们会尽快回复您！' };
    },
  },
};

// ===== Modal 渲染 =====
let currentFormType = null;

function ensureModal() {
  let modal = document.getElementById(MODAL_ID);
  if (modal) return modal;

  // Overlay
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.5);opacity:0;transition:opacity .3s ease;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.body.appendChild(overlay);

  // Modal box
  modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '表单对话框');
  modal.style.cssText =
    'background:var(--color-bg);border-radius:16px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,.2);opacity:0;transform:translateY(20px) scale(.96);transition:opacity .3s ease,transform .3s ease';
  overlay.appendChild(modal);

  return modal;
}

function renderForm(type) {
  currentFormType = type;
  const def = formDefs[type];
  if (!def) return;

  const modal = ensureModal();
  modal.setAttribute('aria-label', def.title);

  const fieldsHtml = def.fields
    .map((f) => {
      const inputTag = f.type === 'textarea'
        ? `<textarea id="field-${f.name}" name="${f.name}" rows="${f.rows || 3}" placeholder="${f.placeholder || ''}" autocomplete="${f.autocomplete || 'off'}" class="form-input"></textarea>`
        : `<input id="field-${f.name}" name="${f.name}" type="${f.type}" placeholder="${f.placeholder || ''}" autocomplete="${f.autocomplete || 'off'}" class="form-input">`;
      return `
      <div class="form-field">
        <label for="field-${f.name}" class="form-label">${f.label}</label>
        ${inputTag}
        <span class="form-error" id="error-${f.name}" role="alert" aria-live="polite"></span>
      </div>`;
    })
    .join('');

  modal.innerHTML = `
    <div class="form-header">
      <h2 class="form-title">${def.title}</h2>
      <button class="form-close" aria-label="关闭对话框" id="form-close-btn">&times;</button>
    </div>
    <form class="form-body" id="form-body" novalidate>
      ${fieldsHtml}
      <button type="submit" class="btn-primary form-submit" id="form-submit-btn">
        ${def.submitLabel}
      </button>
    </form>
    ${def.hasOAuth ? `
    <div class="form-divider"><span>或</span></div>
    <div class="form-oauth" id="formOAuth">
      <button class="btn-oauth" data-oauth="github">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/></svg>
        GitHub 登录
      </button>
    </div>
    ` : ''}
    ${def.footer ? `<div class="form-footer">${def.footer}</div>` : ''}
  `;

  // 关闭按钮
  modal.querySelector('#form-close-btn').addEventListener('click', closeModal);

  // 表单提交
  const form = modal.querySelector('#form-body');
  form.addEventListener('submit', handleSubmit);

  // 底部链接切换（支持多个 data-form 链接）
  if (def.footer) {
    modal.querySelectorAll('[data-form]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        renderForm(e.target.getAttribute('data-form'));
      });
    });
  }

  // OAuth 按钮
  const oauthBtns = modal.querySelectorAll('[data-oauth]');
  oauthBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = '跳转中...';
      const result = await authSignInWithOAuth(btn.dataset.oauth);
      if (!result.success) {
        showToast(result.message, 'error');
        btn.disabled = false;
        btn.textContent = 'GitHub 登录';
      }
    });
  });

  // 实时校验（失焦）
  form.querySelectorAll('.form-input').forEach((input) => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      // 清除已有的错误提示
      const errorEl = document.getElementById(`error-${input.name}`);
      if (errorEl && errorEl.textContent) validateField(input);
    });
  });

  // 焦点陷阱
  setupFocusTrap(modal);

  // 展示动画
  const overlay = document.getElementById(OVERLAY_ID);
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    modal.style.opacity = '1';
    modal.style.transform = 'translateY(0) scale(1)';
  });

  // 聚焦第一个输入
  setTimeout(() => {
    const firstInput = modal.querySelector('.form-input');
    if (firstInput) firstInput.focus();
  }, 350);
}

function validateField(input) {
  const def = formDefs[currentFormType];
  const fieldDef = def.fields.find((f) => f.name === input.name);
  if (!fieldDef) return true;

  const errorEl = document.getElementById(`error-${input.name}`);
  const value = input.value;

  // 按顺序检查规则，取第一个失败
  for (const rule of fieldDef.rules) {
    let error = '';
    if (rule === 'required') error = validators.required(value);
    else if (rule === 'email') error = validators.email(value);
    else if (rule === 'password') error = validators.password(value);
    else if (typeof rule === 'string' && rule.startsWith('minLength:')) {
      error = validators.minLength(parseInt(rule.split(':')[1], 10))(value);
    }
    else if (typeof rule === 'string' && rule.startsWith('match:')) {
      const targetName = rule.split(':')[1];
      const targetInput = input.form
        ? input.form.querySelector(`[name="${targetName}"]`)
        : document.querySelector(`[name="${targetName}"]`);
      const targetValue = targetInput ? targetInput.value : '';
      error = validators.match(targetValue)(value);
    }

    if (error) {
      errorEl.textContent = error;
      input.setAttribute('aria-invalid', 'true');
      input.style.borderColor = 'var(--color-error, #E5484D)';
      return false;
    }
  }

  errorEl.textContent = '';
  input.removeAttribute('aria-invalid');
  input.style.borderColor = '';
  return true;
}

function validateAll(form) {
  let valid = true;
  form.querySelectorAll('.form-input').forEach((input) => {
    if (!validateField(input)) valid = false;
  });
  return valid;
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const def = formDefs[currentFormType];

  if (!validateAll(form)) {
    showToast('请修正表单中的错误', 'warning');
    return;
  }

  // 收集数据
  const data = {};
  def.fields.forEach((f) => {
    const input = form.querySelector(`[name="${f.name}"]`);
    if (input) data[f.name] = input.value.trim();
  });

  // 按钮 loading
  const btn = form.querySelector('#form-submit-btn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '处理中...';
  btn.classList.add('btn-loading');

  // 模拟异步提交
  try {
    await new Promise((r) => setTimeout(r, 1200));
    const result = await def.onSubmit(data);

    if (result.success) {
      if (result.needsVerification) {
        // 邮箱验证：在表单内展示提示，不关闭弹窗
        renderVerificationNotice(modal, data.email);
      } else {
        showToast(result.message, 'success');
        closeModal();
      }
    } else {
      showToast(result.message || '操作失败，请稍后再试', 'error');
    }
  } catch (err) {
    const msg = err.message || '网络异常，请稍后再试';
    showToast(msg, 'error');
    logger.error('表单提交失败:', currentFormType, err);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
    btn.classList.remove('btn-loading');
  }
}

function closeModal() {
  const overlay = document.getElementById(OVERLAY_ID);
  const modal = document.getElementById(MODAL_ID);

  if (!overlay || !modal) return;

  overlay.style.opacity = '0';
  modal.style.opacity = '0';
  modal.style.transform = 'translateY(20px) scale(.96)';

  setTimeout(() => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    // 恢复之前焦点
    if (_formTriggerEl) {
      _formTriggerEl.focus();
      _formTriggerEl = null;
    }
  }, 300);

  window.removeEventListener('keydown', _formModalEscHandler);
  _formModalEscHandler = null;
  currentFormType = null;
}

// Esc 关闭
function setupFocusTrap(_modal) {
  _formModalEscHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  };
  window.addEventListener('keydown', _formModalEscHandler);
}

/** 在注册表单内展示邮箱验证提示 */
function renderVerificationNotice(modal, email) {
  modal.setAttribute('aria-label', '邮箱验证');
  modal.innerHTML = `
    <div class="form-header">
      <h2 class="form-title">验证你的邮箱</h2>
      <button class="form-close" aria-label="关闭对话框" id="form-close-btn">&times;</button>
    </div>
    <div class="form-body verification-notice" style="text-align:center;padding:24px 16px;">
      <div style="font-size:48px;margin-bottom:16px;">📧</div>
      <p style="font-size:16px;margin-bottom:8px;color:var(--color-text);">验证邮件已发送至</p>
      <p style="font-weight:600;font-size:15px;color:var(--color-primary,#6B8AFF);margin-bottom:16px;">${email}</p>
      <p style="font-size:14px;color:var(--color-muted);line-height:1.6;">
        请点击邮件中的<b>确认链接</b>完成注册。<br>
        如果没有收到，请检查<b>垃圾邮件</b>文件夹。
      </p>
      <button class="btn-primary" id="verification-done-btn" style="margin-top:20px;width:100%;">知道了</button>
    </div>
  `;
  modal.querySelector('#form-close-btn').addEventListener('click', closeModal);
  modal.querySelector('#verification-done-btn').addEventListener('click', closeModal);
}

// ===== 公开 API =====

/**
 * 打开指定类型的表单弹窗
 * @param {'register'|'login'|'contact'} type
 * @param {HTMLElement} [triggerEl] — 触发元素（用于关闭后恢复焦点）
 */
export function openForm(type, triggerEl) {
  if (!formDefs[type]) {
    logger.error('未知表单类型:', type);
    return;
  }
  if (triggerEl) _formTriggerEl = triggerEl;
  renderForm(type);
}

export { formDefs };
