/**
 * 批量导入 bioSkills
 * 使用 action 来访问 storage，然后调用 mutation 写入数据库
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import { internalAction, internalMutation, internalQuery } from "./functions";
import { generateEmbedding, EMBEDDING_DIMENSIONS } from "./lib/embeddings";
import { extractDigestFields } from "./lib/skillSearchDigest";

const BioSkillSpec = v.object({
  slug: v.string(),
  displayName: v.string(),
  summary: v.string(),
  version: v.string(),
  rawSkillMd: v.string(),
});

/**
 * Mutation: 创建 skill 并立即更新 digest
 */
async function createSkillAndDigest(
  ctx: MutationCtx,
  args: {
    slug: string;
    displayName: string;
    summary: string;
    version: string;
    rawSkillMd: string;
    storageId: string;
    adminUserId: string;
  }
): Promise<{ success: boolean; error?: string; skillId?: string }> {
  try {
    const now = Date.now();

    // 检查是否已存在
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (existing) {
      return { success: true, skillId: existing._id }; // 已存在
    }

    // 解析 frontmatter
    const lines = args.rawSkillMd.split('\n');
    const frontmatter: Record<string, string> = {};
    let inFrontmatter = false;
    for (const line of lines) {
      if (line === '---') {
        inFrontmatter = !inFrontmatter;
        continue;
      }
      if (inFrontmatter && line.includes(':')) {
        const [key, ...valParts] = line.split(':');
        frontmatter[key.trim()] = valParts.join(':').trim();
      }
    }

    // 创建 version
    const versionId = await ctx.db.insert("skillVersions", {
      skillId: undefined as any, // 临时，稍后更新
      version: args.version,
      changelog: "- Initial release.",
      changelogSource: "auto",
      files: [{
        path: "SKILL.md",
        size: args.rawSkillMd.length,
        storageId: args.storageId as any,
        sha256: "imported_" + now,
        contentType: "text/markdown",
      }],
      parsed: {
        frontmatter,
        metadata: {},
      },
      createdBy: args.adminUserId as any,
      createdAt: now,
      sha256hash: "imported_" + now,
    });

    // 创建 skill（带 latestVersionId）
    const skillId = await ctx.db.insert("skills", {
      slug: args.slug,
      displayName: args.displayName,
      summary: args.summary,
      ownerUserId: args.adminUserId as any,
      createdAt: now,
      updatedAt: now,
      latestVersionId: versionId,
      tags: { latest: versionId },
      badges: {},
      stats: {
        versions: 1,
        installsCurrent: 0,
        installsAllTime: 0,
        downloads: 0,
        stars: 0,
        comments: 0,
      },
    });

    // 更新 version 的 skillId
    await ctx.db.patch(versionId, { skillId: skillId as any });

    // 手动创建 skillSearchDigest（确保正确性）
    const skill = await ctx.db.get(skillId);
    if (skill) {
      const owner = await ctx.db.get(skill.ownerUserId);
      const isOwnerVisible = owner && !owner.deletedAt && !owner.deactivatedAt;
      
      // 直接插入 digest
      await ctx.db.insert("skillSearchDigest", {
        ...extractDigestFields(skill),
        skillId: skillId,
        isSuspicious: skill.isSuspicious,
        ownerHandle: isOwnerVisible ? (owner?.handle ?? "") : "",
        ownerName: isOwnerVisible ? owner?.name : undefined,
        ownerDisplayName: isOwnerVisible ? owner?.displayName : undefined,
        ownerImage: isOwnerVisible ? (owner?.image ?? undefined) : undefined,
      });
    }

    return { success: true, skillId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Mutation: 直接使用 storageId 创建 skill
 */
export const importWithStorageId = internalMutation({
  args: {
    slug: v.string(),
    displayName: v.string(),
    summary: v.string(),
    version: v.string(),
    rawSkillMd: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // 获取第一个用户
    const users = await ctx.db.query("users").take(1);
    const adminUser = users[0];

    if (!adminUser) {
      return { success: false, error: "No user found" };
    }

    const result = await createSkillAndDigest(ctx, {
      ...args,
      adminUserId: adminUser._id,
    });

    return { success: result.success, error: result.error };
  },
});

/**
 * Action: 存储文件，然后调用 mutation
 */
export const importSingleSkill = internalAction({
  args: {
    spec: BioSkillSpec,
  },
  handler: async (ctx: ActionCtx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      const { spec } = args;

      // 将 SKILL.md 存入 storage
      const blob = new Blob([spec.rawSkillMd], { type: "text/markdown" });
      const storageId = await ctx.storage.store(blob);

      // 调用 mutation
      return await ctx.runMutation(internal.bioSkillsImport.importWithStorageId, {
        slug: spec.slug,
        displayName: spec.displayName,
        summary: spec.summary,
        version: spec.version,
        rawSkillMd: spec.rawSkillMd,
        storageId,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  },
});

/**
 * Action: 批量导入多个 skills
 */
export const importBatchSkills = internalAction({
  args: {
    specs: v.array(BioSkillSpec),
  },
  handler: async (ctx: ActionCtx, args): Promise<{ success: boolean; imported: number; errors: string[] }> => {
    const errors: string[] = [];
    let imported = 0;

    for (const spec of args.specs) {
      try {
        // 存储文件
        const blob = new Blob([spec.rawSkillMd], { type: "text/markdown" });
        const storageId = await ctx.storage.store(blob);

        // 调用 mutation
        const result = await ctx.runMutation(internal.bioSkillsImport.importWithStorageId, {
          slug: spec.slug,
          displayName: spec.displayName,
          summary: spec.summary,
          version: spec.version,
          rawSkillMd: spec.rawSkillMd,
          storageId,
        });

        if (result.success) {
          imported++;
        } else {
          errors.push(`${spec.slug}: ${result.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${spec.slug}: ${errorMsg}`);
      }
    }

    return { success: errors.length === 0, imported, errors };
  },
});

/**
 * Internal query: 获取所有 skill slugs（用于对比缺失）
 */
export const getAllSlugsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const skills = await ctx.db.query("skills").take(2000);
    return {
      count: skills.length,
      slugs: skills.map(s => s.slug).sort(),
    };
  },
});

/**
 * 检查现有 embeddings 状态
 */
export const checkEmbeddingsStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const embeddings = await ctx.db.query("skillEmbeddings").take(2000);
    const zeroEmbeddings = embeddings.filter(e => e.embedding.every((v: number) => v === 0));
    return {
      total: embeddings.length,
      zeroCount: zeroEmbeddings.length,
      dimensions: embeddings[0]?.embedding?.length ?? 0,
      sample: embeddings.slice(0, 3).map(e => ({
        id: e._id,
        skillId: e.skillId,
        isLatest: e.isLatest,
        isApproved: e.isApproved,
        firstValues: e.embedding.slice(0, 5),
        isZero: e.embedding.every((v: number) => v === 0),
      })),
    };
  },
});

/**
 * 获取所有零 embedding 的 skills
 */
export const getZeroEmbeddings = internalQuery({
  args: {},
  handler: async (ctx) => {
    const embeddings = await ctx.db.query("skillEmbeddings").take(2000);
    const zeroEmbeddings = embeddings.filter(e => e.embedding.every((v: number) => v === 0));
    return {
      count: zeroEmbeddings.length,
      slugs: await Promise.all(zeroEmbeddings.map(async e => {
        const skill = await ctx.db.get(e.skillId);
        return skill?.slug || 'unknown';
      })),
    };
  },
});

/**
 * Action: 重新生成所有 skill embeddings（带进度追踪）
 */
export const regenerateAllEmbeddings = internalAction({
  args: {
    batchSize: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; processed: number; total: number; nextOffset?: number; errors: string[] }> => {
    const errors: string[] = [];
    let processed = 0;
    const batchSize = args.batchSize ?? 10;
    const offset = args.offset ?? 0;

    // 获取所有 skills
    const skills = await ctx.runQuery(internal.bioSkillsImport.getAllSlugsInternal);
    const total = skills.count;
    
    console.log(`Processing batch at offset ${offset}, batchSize ${batchSize} (total: ${total})`);

    const batch = skills.slugs.slice(offset, offset + batchSize);
    
    if (batch.length === 0) {
      return { success: true, processed: 0, total, errors: [] };
    }

    for (const slug of batch) {
      try {
        // 获取 skill
        const skill = await ctx.runQuery(internal.bioSkillsImport.getSkillBySlugInternal, { slug });
        if (!skill) {
          errors.push(`${slug}: skill not found`);
          continue;
        }

        // 获取最新 version
        if (!skill.latestVersionId) {
          errors.push(`${slug}: no latest version`);
          continue;
        }

        const version = await ctx.runQuery(internal.bioSkillsImport.getVersionByIdInternal, { 
          versionId: skill.latestVersionId 
        });
        if (!version) {
          errors.push(`${slug}: version not found`);
          continue;
        }

        // 生成 embedding 文本
        const textForEmbedding = `${skill.displayName}\n${skill.summary || ''}\n${version.description || ''}`;
        
        // 调用 Gitee AI 生成 embedding
        const embedding = await generateEmbedding(textForEmbedding);

        // 更新 embedding
        const result = await ctx.runMutation(internal.bioSkillsImport.updateSkillEmbedding, {
          skillId: skill._id,
          versionId: skill.latestVersionId,
          embedding,
        });

        if (result.success) {
          processed++;
        } else {
          errors.push(`${slug}: ${result.error}`);
        }

        // 延迟避免 rate limit
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${slug}: ${errorMsg}`);
      }
    }

    const nextOffset = offset + batch.length < total ? offset + batch.length : undefined;
    return { success: errors.length === 0, processed, total, nextOffset, errors };
  },
});

/**
 * Internal query: 通过 slug 获取 skill
 */
export const getSkillBySlugInternal = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const skill = await ctx.db
      .query("skills")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!skill) return null;
    return {
      _id: skill._id,
      _creationTime: skill._creationTime,
      slug: skill.slug,
      displayName: skill.displayName,
      summary: skill.summary,
      latestVersionId: skill.latestVersionId,
      ownerUserId: skill.ownerUserId,
    };
  },
});

/**
 * Internal query: 通过 ID 获取 version
 */
export const getVersionByIdInternal = internalQuery({
  args: { versionId: v.id("skillVersions") },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) return null;
    return {
      _id: version._id,
      skillId: version.skillId,
      description: version.parsed?.frontmatter?.description as string | undefined,
    };
  },
});

/**
 * Internal mutation: 更新 skill embedding
 */
export const updateSkillEmbedding = internalMutation({
  args: {
    skillId: v.id("skills"),
    versionId: v.id("skillVersions"),
    embedding: v.array(v.number()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      const now = Date.now();

      // 查找现有的最新 embedding
      const existingEmbedding = await ctx.db
        .query("skillEmbeddings")
        .withIndex("by_version", (q) => q.eq("versionId", args.versionId))
        .unique();

      if (existingEmbedding) {
        // 更新现有 embedding
        await ctx.db.patch(existingEmbedding._id, {
          embedding: args.embedding,
          updatedAt: now,
        });
      } else {
        // 创建新的 embedding
        const skill = await ctx.db.get(args.skillId);
        if (!skill) {
          return { success: false, error: "Skill not found" };
        }

        const embeddingId = await ctx.db.insert("skillEmbeddings", {
          skillId: args.skillId,
          versionId: args.versionId,
          ownerId: skill.ownerUserId,
          embedding: args.embedding,
          isLatest: true,
          isApproved: false,
          visibility: "latest-unapproved",
          updatedAt: now,
        });

        await ctx.db.insert("embeddingSkillMap", {
          embeddingId,
          skillId: args.skillId,
        });
      }

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  },
});

/**
 * Action: 重新生成指定 skill 的 embedding
 */
export const regenerateSkillEmbedding = internalAction({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      const skill = await ctx.runQuery(internal.bioSkillsImport.getSkillBySlugInternal, { slug: args.slug });
      if (!skill) {
        return { success: false, error: "Skill not found" };
      }

      if (!skill.latestVersionId) {
        return { success: false, error: "No latest version" };
      }

      const version = await ctx.runQuery(internal.bioSkillsImport.getVersionByIdInternal, { 
        versionId: skill.latestVersionId 
      });
      if (!version) {
        return { success: false, error: "Version not found" };
      }

      const textForEmbedding = `${skill.displayName}\n${skill.summary || ''}\n${version.description || ''}`;
      const embedding = await generateEmbedding(textForEmbedding);

      const result = await ctx.runMutation(internal.bioSkillsImport.updateSkillEmbedding, {
        skillId: skill._id,
        versionId: skill.latestVersionId,
        embedding,
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  },
});

import { hashToken, generateToken } from "./lib/tokens";

/**
 * 创建 API token（返回实际 token 值）
 */
export const createApiTokenForUser = internalMutation({
  args: {
    userId: v.id("users"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { token, prefix } = generateToken();
    const tokenHash = await hashToken(token);
    
    const tokenId = await ctx.db.insert("apiTokens", {
      userId: args.userId,
      prefix,
      tokenHash,
      label: args.label,
      lastUsedAt: undefined,
      revokedAt: undefined,
      createdAt: now,
    });
    return { tokenId, token, prefix };
  },
});

/**
 * 通过 handle 查找用户
 */
export const getUserByHandle = internalQuery({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("handle", (q) => q.eq("handle", args.handle))
      .unique();
    if (!user) return null;
    return {
      _id: user._id,
      handle: user.handle,
      name: user.name,
      role: user.role,
      email: user.email,
    };
  },
});

/**
 * 删除指定 slug 的 skill（仅用于清理重复）
 */
export const deleteSkillBySlug = internalMutation({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; deletedId?: string }> => {
    try {
      const skill = await ctx.db
        .query("skills")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug))
        .unique();
      
      if (!skill) {
        return { success: false, error: "Skill not found" };
      }

      const skillId = skill._id;

      // 删除关联的 embeddings
      const embeddings = await ctx.db
        .query("skillEmbeddings")
        .withIndex("by_skill", (q) => q.eq("skillId", skillId))
        .collect();
      
      for (const emb of embeddings) {
        await ctx.db.delete(emb._id);
        // 删除 embeddingSkillMap
        const maps = await ctx.db
          .query("embeddingSkillMap")
          .withIndex("by_embedding", (q) => q.eq("embeddingId", emb._id))
          .collect();
        for (const m of maps) {
          await ctx.db.delete(m._id);
        }
      }

      // 删除 versions
      const versions = await ctx.db
        .query("skillVersions")
        .withIndex("by_skill", (q) => q.eq("skillId", skillId))
        .collect();
      
      for (const ver of versions) {
        await ctx.db.delete(ver._id);
      }

      // 删除 skillSearchDigest
      const digest = await ctx.db
        .query("skillSearchDigest")
        .withIndex("by_skill", (q) => q.eq("skillId", skillId))
        .unique();
      if (digest) {
        await ctx.db.delete(digest._id);
      }

      // 删除 skill
      await ctx.db.delete(skillId);

      return { success: true, deletedId: skillId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  },
});

/**
 * 检查指定 slugs 是否存在
 */
export const checkSlugsExist = internalQuery({
  args: {
    slugs: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const results: Record<string, boolean> = {};
    for (const slug of args.slugs) {
      const skill = await ctx.db
        .query("skills")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      results[slug] = !!skill;
    }
    return results;
  },
});

/**
 * 检查 skills 状态
 */
export const getSkillsStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const skills = await ctx.db.query("skills").take(2000);
    const active = skills.filter(s => !s.softDeletedAt);
    const deleted = skills.filter(s => s.softDeletedAt);
    
    return {
      total: skills.length,
      active: active.length,
      softDeleted: deleted.length,
      sampleActive: active.slice(0, 5).map(s => s.slug),
      sampleDeleted: deleted.slice(0, 5).map(s => s.slug),
    };
  },
});

/**
 * 检查 digest 数量
 */
export const getDigestCount = internalQuery({
  args: {},
  handler: async (ctx) => {
    const digests = await ctx.db.query("skillSearchDigest").take(2000);
    return {
      total: digests.length,
      active: digests.filter(d => !d.softDeletedAt).length,
    };
  },
});

/**
 * 检查 moderation 状态
 */
export const checkModerationStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const skills = await ctx.db.query("skills").take(100);
    return skills.map(s => ({
      slug: s.slug,
      moderationStatus: s.moderationStatus,
      moderationFlags: s.moderationFlags,
      softDeletedAt: s.softDeletedAt,
    }));
  },
});

/**
 * 检查 digest 中的 moderation 状态
 */
export const checkDigestModeration = internalQuery({
  args: {},
  handler: async (ctx) => {
    const digests = await ctx.db.query("skillSearchDigest").take(1500);
    const active = digests.filter(d => !d.softDeletedAt);
    const byStatus: Record<string, number> = {};
    for (const d of active) {
      const status = d.moderationStatus || 'null';
      byStatus[status] = (byStatus[status] || 0) + 1;
    }
    return {
      total: digests.length,
      active: active.length,
      byStatus,
      sample: active.slice(0, 3).map(d => ({slug: d.slug, status: d.moderationStatus})),
    };
  },
});

/**
 * Backfill: 为没有 digest 的 skills 创建 digest
 */
export const backfillMissingDigests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const skills = await ctx.db.query("skills").take(2000);
    let created = 0;
    let skipped = 0;
    
    for (const skill of skills) {
      // 检查是否已有 digest
      const existing = await ctx.db
        .query("skillSearchDigest")
        .withIndex("by_skill", (q) => q.eq("skillId", skill._id))
        .unique();
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // 创建 digest
      const owner = await ctx.db.get(skill.ownerUserId);
      const isOwnerVisible = owner && !owner.deletedAt && !owner.deactivatedAt;
      
      await ctx.db.insert("skillSearchDigest", {
        ...extractDigestFields(skill),
        skillId: skill._id,
        isSuspicious: skill.isSuspicious,
        ownerHandle: isOwnerVisible ? (owner?.handle ?? "") : "",
        ownerName: isOwnerVisible ? owner?.name : undefined,
        ownerDisplayName: isOwnerVisible ? owner?.displayName : undefined,
        ownerImage: isOwnerVisible ? (owner?.image ?? undefined) : undefined,
      });
      
      created++;
    }
    
    return { created, skipped, total: skills.length };
  },
});
