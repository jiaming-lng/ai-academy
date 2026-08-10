import { defineConfig } from 'vite';
import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 内联 Gzip 插件 — 构建后压缩产物，无需额外依赖。
 * 为每个 .js / .css / .html 文件生成 .gz 副本，供 Nginx/CDN 直接 serve。
 */
function gzipPlugin() {
  let outDir;
  return {
    name: 'vite-plugin-gzip-inline',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle(_, bundle) {
      const exts = ['.js', '.css', '.html', '.svg', '.xml', '.txt'];
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' || chunk.type === 'asset') {
          if (exts.some((ext) => fileName.endsWith(ext))) {
            const source = chunk.type === 'chunk' ? chunk.code : chunk.source;
            const buf = typeof source === 'string' ? Buffer.from(source) : source;
            const gzipped = gzipSync(buf, { level: 9 });
            writeFileSync(join(outDir, fileName + '.gz'), gzipped);
          }
        }
      }
      console.log('[gzip] .gz files generated for all static assets');
    },
  };
}

// 多页构建：每个 HTML 作为独立入口，输出到 dist/
// base: './' 使构建产物使用相对路径，可部署到任意子目录
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    // safe-delete 机制阻塞 rmSync，关闭自动清空；构建前请手动清理 dist
    emptyOutDir: false,
    // 生成 manifest.json 方便后端做资源映射
    manifest: true,
    // CSS 拆分：每个入口的 CSS 独立文件
    cssCodeSplit: true,
    // 资源内联阈值：小于 4KB 的资源内联为 base64
    assetsInlineLimit: 4096,
    // 目标浏览器：现代浏览器即可
    target: 'es2020',
    rollupOptions: {
      // Supabase SDK 静态导入后需要打包到 bundle 中，不能 external
      input: {
        main: 'index.html',
        courses: 'courses.html',
        courseDetail: 'course-detail.html',
        dashboard: 'dashboard.html',
        lesson: 'lesson.html',
        community: 'community.html',
        about: 'about.html',
        notFound: '404.html',
        privacy: 'privacy.html',
        terms: 'terms.html',
        resetPassword: 'reset-password.html',
      },
      output: {
        // 代码分割策略：按功能分组
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('/js/config/')) {
            return 'config';
          }
          if (id.includes('/js/icons.js')) {
            return 'icons';
          }
        },
        // 入口 chunk 命名
        entryFileNames: 'js/[name]-[hash:8].js',
        chunkFileNames: 'js/[name]-[hash:8].js',
        assetFileNames: 'assets/[name]-[hash:8][extname]',
      },
    },
    // esbuild 压缩（Vite 默认，无需额外安装）
    minify: 'esbuild',
  },
  plugins: [gzipPlugin()],
  // 开发服务器配置
  server: {
    port: 3000,
    open: false,
  },
  preview: {
    port: 4173,
    open: false,
  },
});
