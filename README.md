# SkillHub for BGI — 生物信息学 Agent Skill 平台

<p align="center">
  <img src="public/clawd-logo.png" alt="SkillHub" width="120">
</p>

<h1 align="center">SkillHub</h1>

<p align="center">
  <strong>面向中国生物学研究者的 Agent Skill 统一仓库</strong>
</p>

<p align="center">
  <a href="#核心功能">核心功能</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#技术架构">技术架构</a> ·
  <a href="#贡献指南">贡献指南</a> ·
  <a href="#许可证">许可证</a>
</p>

---

## 项目简介

**SkillHub** 是为 **BGI（华大基因）** 及中国生物学研究社区打造的 Agent Skill 共享、分发与合作平台。研究人员可以将生物信息学分析流程、数据处理脚本打包为标准化 Skill，通过平台进行版本管理和社区共享。

### 核心理念

| 维度 | 说明 |
|------|------|
| **共享** | 研究人员分享自定义的生物信息学分析流程 |
| **分发** | 版本化的 Skill 分发机制，确保分析流程可重复 |
| **合作** | 基于论坛的社区互动，促进知识交流 |

---

## 核心功能

### 🧬 Skill 仓库

- **标准化格式**: 基于 `SKILL.md` 的规范格式，包含元数据、描述、依赖声明
- **版本控制**: 语义化版本 (semver)，支持标签管理 (`latest`, `stable` 等)
- **向量搜索**: 基于 OpenAI Embeddings 的智能搜索，快速发现相关 Skill

### 🔐 统一认证

- **论坛集成**: 支持与 BGI Flarum 论坛的单点登录
- **权限管理**: 用户 / Moderator / Admin 三级权限体系
- **JWT 安全**: 基于 Convex Auth 的会话管理

### 🛠️ 管理工具

- **版本对比**: 可视化 diff 查看版本变更
- **所有权管理**: Skill 重命名、合并、转移
- **审核机制**: 标记精选、官方认证、弃用状态
- **审计日志**: 完整记录所有管理操作

### 💬 社区功能

- **评论系统**: 每个 Skill 支持讨论和反馈
- **评分收藏**: Star 机制标记优质 Skill
- **Report 机制**: 社区自治，标记问题内容

---

## 快速开始

### 安装 CLI

```bash
npm install -g @bgicli/skillhub
```

### 登录

```bash
# 使用 BGI 论坛账号登录
skillhub login
```

### 搜索 Skill

```bash
# 搜索基因分析相关 Skill
skillhub search genome

# 浏览热门 Skill
skillhub explore
```

### 安装 Skill

```bash
# 安装到本地
skillhub install steipete/variant-calling

# 查看已安装
skillhub list

# 更新全部
skillhub update --all
```

### 发布 Skill

```bash
# 进入 Skill 目录
cd ./my-bio-pipeline

# 发布新版本
skillhub publish .

# 或使用自动同步
skillhub sync
```

### Skill 管理

```bash
# 重命名（旧 slug 自动 redirect）
skillhub skill rename old-slug new-slug

# 合并 Skill
skillhub skill merge source-slug target-slug
```

---

## SKILL.md 格式

每个 Skill 必须包含 `SKILL.md` 文件：

```yaml
---
name: variant-calling
description: GATK-based variant calling pipeline for WGS data
metadata:
  clawhub:
    requires:
      bins:
        - gatk
        - samtools
      env:
        - REF_GENOME
    config:
      requiredEnv: ["REF_GENOME"]
      example: |
        REF_GENOME=/data/hg38.fa
---

## 使用方法

```bash
# 运行 variant calling
bash run.sh input.bam output.vcf
```
```

完整规范参见 [`docs/skill-format.md`](docs/skill-format.md)

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                  Vercel Edge (SSR)                          │
│              TanStack Start + React 19                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                   Convex Cloud                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Database  │  │File Storage │  │  Vector Search      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Flarum Bridge (Node.js)                        │
│                 JWT + MySQL                                 │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | TanStack Start (React 19 + Vite 7 + Tailwind CSS 4) |
| 后端 | Convex (Serverless DB + 文件存储 + HTTP Actions) |
| 认证 | Convex Auth + Flarum JWT |
| 搜索 | OpenAI Embeddings + Convex Vector Search |
| 部署 | Vercel + Convex Cloud |

---

## 本地开发

### 环境要求

- [Bun](https://bun.sh/) (Node.js 包管理器)
- Convex CLI (`bunx convex`)

### 快速启动

```bash
# 安装依赖
bun install

# 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local 填入必要配置

# 终端 A: 启动 Convex 后端
bunx convex dev

# 终端 B: 启动开发服务器
bun run dev

# 访问 http://localhost:3000
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `VITE_CONVEX_URL` | Convex 部署 URL |
| `VITE_FLARUM_BRIDGE_URL` | Flarum Bridge 服务地址 |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth (可选) |
| `OPENAI_API_KEY` | 用于向量搜索 |

完整配置参见 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 项目结构

```
├── src/                    # TanStack Start 前端应用
│   ├── routes/            # 文件系统路由
│   ├── components/        # React 组件
│   └── lib/               # 客户端工具函数
├── convex/                # Convex 后端
│   ├── schema.ts          # 数据库 Schema
│   ├── functions.ts       # Queries / Mutations
│   └── http.ts            # HTTP Actions
├── packages/
│   └── schema/            # 共享 API 类型 (CLI 使用)
├── docs/                  # 项目文档
└── cli/                   # CLI 工具源码
```

---

## 贡献指南

我们欢迎社区贡献！请遵循以下流程：

1. **Fork 仓库** 并创建功能分支
2. **遵循代码规范**: `bun run lint` 必须通过
3. **提交前测试**: `bun run test` 和 `bun run coverage`
4. **使用 Conventional Commits**: `feat:`, `fix:`, `docs:`, `chore:`
5. **提交 PR** 并描述变更内容

详细指南参见 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 安全与合规

- **恶意代码扫描**: VirusTotal 集成，自动检测可疑文件
- **静态分析**: LLM 辅助代码审查
- **社区自治**: 用户 Report + 管理员审核双层机制
- **审计日志**: 所有管理操作完整记录

安全报告: [security@openclaw.ai](mailto:security@openclaw.ai)

---

## 相关项目

- [OpenClaw](https://github.com/openclaw/openclaw) - Agent 运行时
- [Flarum](https://flarum.org/) - 论坛软件
- [Convex](https://convex.dev/) - 后端平台

---

## 许可证

本项目基于 **MIT License** 开源。

原 [ClawHub](https://github.com/openclaw/clawhub) 项目由 [OpenClaw](https://openclaw.ai) 团队创建并维护。本仓库是原项目的衍生版本，针对 BGI（华大基因）及中国生物学研究社区进行了本地化和定制。

```
MIT License

Copyright (c) 2024 OpenClaw
Copyright (c) 2025 BGI SkillHub Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<p align="center">
  Made with ❤️ for the BGI & Chinese Bioinformatics Community
</p>

<p align="center">
  <sub>Built on top of <a href="https://github.com/openclaw/clawhub">ClawHub</a></sub>
</p>
