/**
 * seo.js — JSON-LD 结构化数据注入
 *
 * 根据当前页面 data-page 属性，向 <head> 注入对应的 JSON-LD。
 * 帮助搜索引擎（Google / Bing）正确理解页面内容，提升富结果展示。
 * 站点 URL 统一从 site.config.js 读取，部署时改一处即可。
 *
 * 使用 ES module，在每个 HTML 中作为 <script type="module"> 引入。
 */

import { SITE_URL } from './config/site-url.js';

/** @param {Record<string, unknown>} obj */
function injectJsonLd(obj) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(obj, null, 0);
  document.head.appendChild(script);
}

const PAGE_SCHEMAS = {
  'index.html': {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'AI学社',
    url: SITE_URL,
    description: '系统化AI学习平台，提供从零基础到实战的完整课程体系',
    knowsAbout: ['机器学习', '深度学习', 'Prompt Engineering', '自然语言处理'],
    slogan: '让每个人都能驾驭 AI',
  },

  'courses.html': {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'AI学社 · 全部课程',
    url: `${SITE_URL}/courses.html`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'AI基础入门', description: '从零开始掌握人工智能核心概念与原理' },
      { '@type': 'ListItem', position: 2, name: 'Prompt Engineering', description: '掌握提示词工程，让AI真正为你工作' },
      { '@type': 'ListItem', position: 3, name: '深度学习实践', description: '使用主流框架构建并训练神经网络模型' },
      { '@type': 'ListItem', position: 4, name: '大模型应用开发', description: '从 API 调用到 RAG 系统，全链路掌握大模型开发' },
      { '@type': 'ListItem', position: 5, name: 'AI产品设计', description: '理解AI产品设计方法论与用户体验最佳实践' },
      { '@type': 'ListItem', position: 6, name: 'AI伦理与安全', description: '探讨AI伦理边界、安全防护与合规实践' },
    ],
  },

  'community.html': {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: 'AI学社 · 学习社区',
    url: `${SITE_URL}/community.html`,
    description: 'AI学社学员交流讨论社区，分享学习心得，互助解决问题',
  },

  'about.html': {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: '关于 AI学社',
    url: `${SITE_URL}/about.html`,
    description: 'AI学社致力于让每个人都能驾驭AI，提供系统化课程与实战项目',
  },
};

/**
 * 课程详情页动态生成 Course schema
 * 从 URL ?id= 读取课程信息
 */
function injectCourseSchema() {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('id');
  if (!courseId) return;

  // 动态 import 避免非详情页加载课程数据
  import('./config/courses.data.js').then(({ getCourseById }) => {
    const course = getCourseById(courseId);
    if (!course) return;

    injectJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: course.title,
      description: course.summary,
      url: `${SITE_URL}/course-detail.html?id=${encodeURIComponent(courseId)}`,
      provider: {
        '@type': 'Organization',
        name: 'AI学社',
        url: SITE_URL,
      },
      hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: 'online',
        instructor: course.instructor
          ? { '@type': 'Person', name: course.instructor.name, jobTitle: course.instructor.title }
          : undefined,
      },
      offers: {
        '@type': 'Offer',
        price: course.price,
        priceCurrency: 'CNY',
        availability: 'https://schema.org/InStock',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: course.rating,
        reviewCount: Math.round((course.enrolled || 0) * 0.3),
        bestRating: 5,
      },
    });
  }).catch(() => {});
}

function init() {
  const pageName = document.body.dataset.page;
  if (!pageName) return;

  const schema = PAGE_SCHEMAS[pageName];
  if (schema) {
    injectJsonLd(schema);
  }

  // 课程详情页动态注入 Course schema
  if (pageName === 'course-detail.html') {
    injectCourseSchema();
  }
}

init();
