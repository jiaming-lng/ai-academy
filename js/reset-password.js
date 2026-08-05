/**
 * 密码重置页面 — 处理 Supabase 密码重置回调
 * URL 格式: /reset-password.html#access_token=xxx&refresh_token=yyy&type=recovery
 */
import { getSupabase } from './supabase.js';
import { updatePassword } from './auth.js';

async function init() {
  const loadingEl = document.getElementById('resetLoading');
  const errorEl = document.getElementById('resetError');
  const errorMsg = document.getElementById('resetErrorMsg');
  const formEl = document.getElementById('resetForm');

  try {
    const sb = await getSupabase();
    if (!sb) {
      throw new Error('数据库未连接');
    }

    // Supabase auth 会自动从 URL hash 中恢复 session
    const { data: { session }, error: sessionErr } = await sb.auth.getSession();
    if (sessionErr || !session) {
      throw new Error('链接已过期或无效，请重新申请密码重置。');
    }

    // Session 有效，显示重置密码表单
    loadingEl.style.display = 'none';
    formEl.style.display = 'block';

  } catch (err) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorMsg.textContent = err.message;
  }
}

// 密码校验
function validatePassword(value) {
  if (!value) return '请输入新密码';
  if (value.length < 8) return '密码至少需要 8 个字符';
  if (!/[A-Za-z]/.test(value)) return '密码需包含字母';
  if (!/[0-9]/.test(value)) return '密码需包含数字';
  return '';
}

// 表单提交
document.addEventListener('DOMContentLoaded', () => {
  init();

  const form = document.getElementById('resetPasswordForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = document.getElementById('newPassword').value.trim();
    const confirm = document.getElementById('confirmPassword').value.trim();
    const errorPassword = document.getElementById('error-password');
    const errorConfirm = document.getElementById('error-confirm');
    const btn = document.getElementById('resetSubmitBtn');

    // 校验
    const pwdErr = validatePassword(password);
    errorPassword.textContent = pwdErr;
    if (pwdErr) return;

    if (password !== confirm) {
      errorConfirm.textContent = '两次输入的密码不一致';
      return;
    }
    errorConfirm.textContent = '';

    // 提交
    btn.disabled = true;
    btn.textContent = '处理中...';

    const result = await updatePassword(password);
    if (result.success) {
      form.style.display = 'none';
      document.getElementById('resetSuccess').style.display = 'block';
      setTimeout(() => { window.location.href = 'index.html'; }, 3000);
    } else {
      errorPassword.textContent = result.message;
      btn.disabled = false;
      btn.textContent = '重置密码';
    }
  });
});
