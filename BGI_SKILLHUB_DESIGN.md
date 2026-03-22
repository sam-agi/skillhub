# SkillHub for BGI — 设计说明文档

## 项目定位

**SkillHub** 是面向中国生物学研究者的 Agent Skill 统一平台，主要为 **BGI（华大基因）** 及国内生物信息学社区提供服务。

### 核心理念

- **共享 (Share)**: 研究人员可以分享自定义的生物信息学分析流程、数据处理脚本
- **分发 (Distribute)**: 版本化的 Skill 分发机制，确保分析流程的可重复性
- **合作 (Collaborate)**: 基于 Flarum 论坛的社区互动，促进知识交流

---

## 目标用户

### 主要用户群体

1. **生物信息学研究人员**
   - 需要标准化分析流程的科研人员
   - 希望复用他人开发的分析工具

2. **BGI/华大基因内部团队**
   - 各研究部门的数据分析人员
   - 需要统一管理内部分析流程

3. **中国生物学社区**
   - 高校生物信息学实验室
   - 科研机构的数据处理团队

### 用户场景

- 研究人员完成一套基因分析流程后，打包成 Skill 分享到平台
- 新入职员工通过平台快速获取团队标准分析流程
- 通过论坛讨论优化 Skill，形成协作生态

---

## 核心功能

### 1. Skill 仓库

```
SKILL.md + 支持文件 → 打包 → 版本管理 → 发布
```

- **标准化格式**: 基于 SKILL.md 的规范格式，包含元数据、描述、依赖
- **版本控制**: 语义化版本 (semver)，支持标签管理 (`latest`, `stable` 等)
- **向量搜索**: 基于文本内容的智能搜索，快速发现相关 Skill

### 2. 认证与集成

| 功能 | 实现 |
|------|------|
| 用户认证 | Flarum 论坛 JWT + Convex Auth |
| 单点登录 | 支持 BGI 论坛账号直接登录 |
| 权限管理 | 用户 / Moderator / Admin 三级权限 |

### 3. 社区功能

- **评论系统**: 每个 Skill 支持讨论和反馈
- **评分收藏**: Star 机制标记优质 Skill
- **版本对比**: 可视化 diff 查看版本变更
- **Report 机制**: 社区自治，标记问题内容

### 4. 管理后台

- **审核工具**: 标记精选、官方认证、弃用状态
- **重复检测**: 自动识别相似 Skill
- **审计日志**: 完整记录所有管理操作
- **批量操作**: 支持批量管理技能所有权

---

## 技术架构

### 前端

```
TanStack Start (React 19 + Vite 7)
├── TanStack Router (文件系统路由)
├── TanStack Query (数据获取)
└── Tailwind CSS 4 (原子化样式)
```

### 后端

```
Convex (Serverless)
├── 数据库存储 (users, skills, versions)
├── 文件存储 (版本文件)
├── 向量搜索 (OpenAI Embeddings)
└── HTTP Actions (API 接口)
```

### 集成服务

```
Flarum Bridge (Node.js)
├── JWT 签发
├── 用户同步
└── 论坛单点登录
```

---

## 界面本地化

已完成全站中文翻译，主要页面包括：

| 页面 | 翻译状态 |
|------|----------|
| 首页 | 已完成 |
| Skill 详情页 | 已完成 |
| 上传/发布页 | 已完成 |
| 个人 Dashboard | 已完成 |
| 设置页 | 已完成 |
| 管理控制台 | 已完成 |
| 版本对比 | 已完成 |
| 评论系统 | 已完成 |

### 专有名词处理

- **保留英文**: `Skill`, `Agent`, `CLI`, `API`, `Token`, `Slug`, `Changelog`
- **中文翻译**: 界面操作、提示信息、描述文字

---

## 特色亮点

### 1. 零门槛上手

- 通过 BGI 论坛账号直接登录
- 拖拽文件夹即可上传 Skill
- 自动生成 Changelog 预览

### 2. 企业级管理

- 支持 Skill 所有权转移
- 组织内部 Skill 归并
- 旧Slug自动Redirect

### 3. 安全与合规

- VirusTotal 集成扫描
- LLM 静态分析检测
- 社区Report + 管理员审核双层机制

### 4. 开发者友好

```bash
# CLI 工具安装
npm install -g @bgicli/skillhub

# 发布 Skill
skillhub publish ./my-bio-skill

# 安装 Skill
skillhub install steipete/variant-calling
```

---

## 部署架构

```
用户浏览器
    ↓
Vercel Edge (TanStack Start SSR)
    ↓
Convex Cloud (数据 + 文件存储)
    ↓
Flarum Bridge (MySQL 用户数据库)
```

- **生产环境**: Vercel + Convex Cloud
- **开发环境**: 本地 Vite + Convex Dev
- **论坛集成**: 内网 Flarum 实例

---

## 未来规划

### 短期 (1-3个月)

- [ ] 与 BGI 内部 GitLab 集成
- [ ] 支持生物信息学特定文件类型预览 (FASTA, VCF, BAM)
- [ ] Skill 运行环境检测 (Docker 镜像支持)

### 中期 (3-6个月)

- [ ] 组织/团队空间
- [ ] 私有 Skill 支持
- [ ] 与 BGI 计算平台集成

### 长期 (6-12个月)

- [ ] Skill 运行沙箱
- [ ] 可视化流程编排器
- [ ] 跨平台 Skill 市场

---

## 项目信息

| 属性 | 值 |
|------|-----|
| 项目名称 | SkillHub (BGI Edition) |
| 版本 | v0.8.0 |
| 技术栈 | TanStack Start + Convex + Flarum |
| 部署状态 | 开发环境运行中 |
| 访问地址 | http://172.16.218.40:8080 |

---

## 相关文档

- [Flarum 集成说明](./FLARUM_AUTH.md)
- [API 文档](./docs/http-api.md)
- [CLI 使用指南](./docs/cli.md)
- [Skill 格式规范](./docs/skill-format.md)

---

*文档版本: 2025-03-22*
*维护团队: BGI Tech Team*
