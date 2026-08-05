// site-url.js — 单一 SITE_URL 出处，部署时改 site.config.js 即可
import { siteConfig } from './site.config.js';
export const SITE_URL = siteConfig.siteUrl;
