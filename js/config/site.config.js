// ============================================================
// site.config.js — 站点级单一配置源
// 导航 / 页脚 / 品牌 / 默认 CTA 全部集中于此
// 修改此处一处，全站（5 个页面）同步更新
// ============================================================

export const siteConfig = {
  // 站点 URL —— 部署后替换为真实域名
  siteUrl: 'https://aiacademy.example.com',

  brand: {
    name: 'AI学社',
    tagline: '让每个人都能驾驭 AI<br>系统化的 AI 学习平台',
    copyright: '© 2026 AI学社. All rights reserved.',
  },

  // 主导航（Header + 移动端导航共用）
  nav: [
    { href: 'index.html', label: '首页' },
    { href: 'courses.html', label: '课程' },
    { href: 'dashboard.html', label: '学习' },
    { href: 'community.html', label: '社区' },
    { href: 'about.html', label: '关于' },
  ],

  // 页脚三栏
  footer: [
    {
      title: '课程',
      links: [
        { label: '基础入门', href: 'courses.html' },
        { label: '实战实验室', href: 'courses.html' },
        { label: '项目实战', href: 'courses.html' },
      ],
    },
    {
      title: '资源',
      links: [
        { label: '关于我们', href: 'about.html' },
        { label: '加入社区', href: 'community.html' },
        { label: '联系我们', href: 'about.html#contact' },
      ],
    },
    {
      title: '法律',
      links: [
        { label: '隐私政策', href: 'privacy.html' },
        { label: '服务条款', href: 'terms.html' },
        { label: '联系我们', href: 'about.html#contact' },
      ],
    },
  ],

  // 默认 CTA（可被 <body data-cta-text / data-cta-href> 覆盖）
  cta: { text: '免费开始', href: 'courses.html' },

  // localStorage 主题键名
  themeKey: 'ai-theme',
};

export default siteConfig;
