-- =============================================
-- AI学社 数据库 Schema
-- 在 Supabase SQL Editor 中执行此文件
-- =============================================

-- 1. 用户资料表（关联 Supabase auth.users）
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE,
  full_name   TEXT,
  avatar_url  TEXT,
  bio         TEXT DEFAULT '',
  github_url  TEXT,
  website     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 自动为新注册用户创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. 课程表
CREATE TABLE IF NOT EXISTS public.courses (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  subtitle      TEXT,
  description   TEXT,
  icon          TEXT DEFAULT 'book-open',
  icon_color    TEXT DEFAULT '#6B8AFF',
  category      TEXT DEFAULT '基础入门',
  level         TEXT CHECK (level IN ('beginner','intermediate','advanced')) DEFAULT 'beginner',
  price         NUMERIC(10,2) DEFAULT 0,
  original_price NUMERIC(10,2),
  instructor    TEXT,
  rating        NUMERIC(3,1) DEFAULT 4.5,
  students_count INTEGER DEFAULT 0,
  lessons_count INTEGER DEFAULT 0,
  duration_hours NUMERIC(5,1) DEFAULT 0,
  status        TEXT CHECK (status IN ('published','draft','archived')) DEFAULT 'published',
  sort_order    INTEGER DEFAULT 0,
  outline       JSONB DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 3. 课时表
CREATE TABLE IF NOT EXISTS public.lessons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     TEXT REFERENCES public.courses(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  video_url     TEXT,
  duration_min  INTEGER DEFAULT 10,
  sort_order    INTEGER DEFAULT 0,
  type          TEXT CHECK (type IN ('video','article','quiz','project')) DEFAULT 'video',
  content       JSONB DEFAULT '{}'::jsonb,
  is_free       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 4. 用户报名表
CREATE TABLE IF NOT EXISTS public.enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id     TEXT REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at   TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  progress_pct  INTEGER DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  UNIQUE(user_id, course_id)
);

-- 5. 学习进度表（每个课时）
CREATE TABLE IF NOT EXISTS public.progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id     UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed     BOOLEAN DEFAULT false,
  watched_seconds INTEGER DEFAULT 0,
  notes         TEXT,
  quiz_score    INTEGER,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- 6. 用户笔记表
CREATE TABLE IF NOT EXISTS public.notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id     UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  timestamp_sec INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 7. 社区帖子表
CREATE TABLE IF NOT EXISTS public.posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  tags          TEXT[] DEFAULT '{}',
  likes_count   INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  is_pinned     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 8. 评论表
CREATE TABLE IF NOT EXISTS public.comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  likes_count   INTEGER DEFAULT 0,
  parent_id     UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 9. 点赞表
CREATE TABLE IF NOT EXISTS public.likes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type   TEXT CHECK (target_type IN ('post','comment')) NOT NULL,
  target_id     UUID NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

-- 10. 证书表
CREATE TABLE IF NOT EXISTS public.certificates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id     TEXT REFERENCES public.courses(id) ON DELETE CASCADE,
  issued_at     TIMESTAMPTZ DEFAULT now(),
  certificate_url TEXT,
  UNIQUE(user_id, course_id)
);

-- 11. Newsletter 订阅表
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  is_active     BOOLEAN DEFAULT true
);

-- =============================================
-- 索引
-- =============================================
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON public.progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON public.lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_posts_user ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_target ON public.likes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_lesson ON public.notes(user_id, lesson_id);

-- =============================================
-- RLS 安全策略
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: 所有人可读，本人可写
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Courses: 所有人可读 published 课程
CREATE POLICY "Published courses are viewable" ON public.courses FOR SELECT USING (status = 'published');

-- Lessons: 所有人可读
CREATE POLICY "Lessons are viewable by everyone" ON public.lessons FOR SELECT USING (true);

-- Enrollments: 本人可读写
CREATE POLICY "Users can manage own enrollments" ON public.enrollments FOR ALL USING (auth.uid() = user_id);

-- Progress: 本人可读写
CREATE POLICY "Users can manage own progress" ON public.progress FOR ALL USING (auth.uid() = user_id);

-- Notes: 本人可读写
CREATE POLICY "Users can manage own notes" ON public.notes FOR ALL USING (auth.uid() = user_id);

-- Posts: 所有人可读，本人可写
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Comments: 所有人可读，本人可写
CREATE POLICY "Comments are viewable" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Likes: 本人可读写
CREATE POLICY "Users can manage own likes" ON public.likes FOR ALL USING (auth.uid() = user_id);

-- Certificates: 本人可读
CREATE POLICY "Users can view own certificates" ON public.certificates FOR SELECT USING (auth.uid() = user_id);

-- Subscriptions: 所有人可写入
CREATE POLICY "Anyone can subscribe" ON public.subscriptions FOR INSERT WITH CHECK (true);

-- =============================================
-- 种子数据：插入 6 门初始课程
-- =============================================
INSERT INTO public.courses (id, title, subtitle, description, icon, icon_color, category, level, price, original_price, instructor, rating, students_count, lessons_count, duration_hours, sort_order, outline) VALUES
('ai-basics', 'AI 基础入门', '从零开始理解人工智能', '系统学习人工智能核心概念，包括机器学习、深度学习、神经网络等基础知识，为后续学习打下坚实基础。', 'cpu', '#6B8AFF', '基础入门', 'beginner', 0, 0, '张明 · AI研究员', 4.8, 12800, 24, 12.5, 1,
 '[{"title":"什么是人工智能","duration":"30min"},{"title":"机器学习基础概念","duration":"45min"},{"title":"监督学习与无监督学习","duration":"40min"},{"title":"深度学习入门","duration":"50min"}]'),
('prompt-engineering', 'Prompt 工程实战', '掌握与 AI 高效对话的艺术', '深入学习 Prompt Engineering 的核心技巧，从基础到高级，涵盖角色扮演、思维链、Few-shot 等实用技术。', 'message-square', '#FF6B6B', '实战技能', 'intermediate', 99, 199, '李婷 · Prompt 专家', 4.9, 9600, 18, 8.0, 2,
 '[{"title":"Prompt 基础原则","duration":"25min"},{"title":"角色扮演 Prompt","duration":"35min"},{"title":"思维链技术(CoT)","duration":"40min"},{"title":"Few-shot Learning 实践","duration":"35min"}]'),
('deep-learning', '深度学习进阶', '掌握神经网络核心技术', '深入理解 CNN、RNN、Transformer 等现代深度学习架构，通过实践项目掌握模型训练与调优。', 'layers', '#A855F7', '高级进阶', 'advanced', 199, 399, '王强 · 算法工程师', 4.7, 5400, 32, 20.0, 3,
 '[{"title":"神经网络数学基础","duration":"50min"},{"title":"卷积神经网络(CNN)","duration":"55min"},{"title":"循环神经网络(RNN/LSTM)","duration":"45min"},{"title":"Transformer 架构详解","duration":"60min"}]'),
('llm-app-dev', 'LLM 应用开发', '构建你的第一个 AI 应用', '从零构建 LLM 驱动的应用，涵盖 API 调用、RAG 检索增强、Agent 开发、LangChain 框架等前沿技术。', 'code-2', '#10B981', '实战技能', 'intermediate', 149, 299, '陈晨 · 全栈开发者', 4.8, 7200, 28, 14.0, 4,
 '[{"title":"LLM API 入门","duration":"30min"},{"title":"LangChain 框架基础","duration":"45min"},{"title":"RAG 检索增强生成","duration":"50min"},{"title":"AI Agent 开发","duration":"55min"}]'),
('ai-product-design', 'AI 产品设计', '设计以 AI 为核心的产品', '学习 AI 产品的设计方法论，包括人机交互原则、对话设计、用户体验优化、伦理考量等内容。', 'palette', '#F59E0B', '产品设计', 'intermediate', 129, 259, '赵敏 · 产品总监', 4.6, 3800, 20, 10.0, 5,
 '[{"title":"AI 产品设计原则","duration":"35min"},{"title":"对话式交互设计","duration":"40min"},{"title":"AI 产品 MVP 方法论","duration":"45min"},{"title":"用户反馈与迭代","duration":"30min"}]'),
('ai-ethics', 'AI 伦理与安全', '构建负责任的 AI 应用', '探讨 AI 伦理的核心议题：偏见与公平、隐私保护、可解释性、安全对齐，培养负责任的 AI 开发者。', 'shield-check', '#EC4899', '理论素养', 'beginner', 0, 0, '周远 · AI 伦理研究员', 4.5, 2900, 16, 8.0, 6,
 '[{"title":"AI 伦理概述","duration":"30min"},{"title":"算法偏见与公平","duration":"35min"},{"title":"AI 隐私保护","duration":"40min"},{"title":"可解释 AI(XAI)","duration":"35min"}]')
ON CONFLICT (id) DO NOTHING;
