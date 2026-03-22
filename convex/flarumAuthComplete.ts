/**
 * Flarum 论坛认证完整实现
 * 
 * 浏览器先通过本地桥接服务验证 Flarum 凭据
 * 然后调用此文件中的函数完成 Convex 登录
 */

import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./functions";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * 获取当前登录用户
 */
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      image: v.union(v.string(), v.null()),
      handle: v.optional(v.string()),
      displayName: v.optional(v.string()),
      role: v.optional(v.string()),
      flarumId: v.optional(v.number()),
      flarumUsername: v.optional(v.string()),
      authProvider: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    
    const user = await ctx.db.get(userId);
    if (!user || user.deactivatedAt || user.deletedAt) return null;
    
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      handle: user.handle,
      displayName: user.displayName,
      role: user.role,
      flarumId: user.flarumId,
      flarumUsername: user.flarumUsername,
      authProvider: user.authProvider,
    };
  },
});

/**
 * 检查当前用户是否通过 Flarum 登录
 */
export const isFlarumAuthenticated = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    
    const user = await ctx.db.get(userId);
    return user?.authProvider === "flarum" && user?.flarumId !== undefined;
  },
});

/**
 * 完成 Flarum 登录（浏览器验证后调用）
 * 
 * 浏览器直接验证 Flarum 凭据后，调用此函数创建/更新 Convex 用户
 * 然后前端通过标准 OAuth 流程或刷新页面获取会话
 */
export const completeFlarumSignIn = action({
  args: {
    flarumId: v.number(),
    username: v.string(),
    email: v.string(),
    avatarUrl: v.union(v.string(), v.null()),
  },
  returns: v.object({
    success: v.boolean(),
    userId: v.optional(v.id("users")),
    token: v.optional(v.string()),
    isNewUser: v.optional(v.boolean()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: true; userId: Id<"users">; token: string; isNewUser: boolean } | { success: false; error: string }> => {
    try {
      // 检查用户是否被禁用
      const existingUser = await ctx.runQuery(internal.flarumAuthComplete.findUserByFlarumId, {
        flarumId: args.flarumId,
      });

      if (existingUser?.deactivatedAt || existingUser?.deletedAt) {
        return { success: false, error: "账号已被禁用或删除" };
      }

      // 创建或更新用户
      const result = await ctx.runMutation(internal.flarumAuthComplete.createOrUpdateFlarumUser, {
        flarumId: args.flarumId,
        username: args.username,
        email: args.email,
        avatarUrl: args.avatarUrl,
      });

      // 生成临时登录令牌（5分钟有效）
      const token = await ctx.runMutation(internal.flarumAuthComplete.createLoginToken, {
        userId: result.userId,
      });

      return {
        success: true,
        userId: result.userId,
        token,
        isNewUser: result.isNewUser,
      };
    } catch (error) {
      console.error("Flarum 登录完成错误:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "登录失败",
      };
    }
  },
});

/**
 * 查找 Flarum 用户
 */
export const findUserByFlarumId = internalQuery({
  args: { flarumId: v.number() },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      deactivatedAt: v.optional(v.number()),
      deletedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("flarumId", (q) => q.eq("flarumId", args.flarumId))
      .unique();
    
    if (!user) return null;
    
    return {
      _id: user._id,
      deactivatedAt: user.deactivatedAt,
      deletedAt: user.deletedAt,
    };
  },
});

/**
 * 创建或更新 Flarum 用户
 */
export const createOrUpdateFlarumUser = internalMutation({
  args: {
    flarumId: v.number(),
    username: v.string(),
    email: v.string(),
    avatarUrl: v.union(v.string(), v.null()),
  },
  returns: v.object({
    userId: v.id("users"),
    isNewUser: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { flarumId, username, email, avatarUrl } = args;
    const now = Date.now();

    // 查找现有用户
    const existing = await ctx.db
      .query("users")
      .withIndex("flarumId", (q) => q.eq("flarumId", flarumId))
      .unique();

    if (existing) {
      // 更新用户信息
      await ctx.db.patch(existing._id, {
        name: username,
        handle: username,
        displayName: username,
        email,
        image: avatarUrl,
        flarumUsername: username,
        flarumSyncedAt: now,
        updatedAt: now,
      });
      return { userId: existing._id, isNewUser: false };
    }

    // 检查邮箱是否已被使用（可能之前用 GitHub 登录过）
    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();

    if (existingByEmail) {
      // 将 Flarum ID 关联到现有用户
      await ctx.db.patch(existingByEmail._id, {
        flarumId,
        flarumUsername: username,
        flarumSyncedAt: now,
        authProvider: "flarum",
        updatedAt: now,
      });
      return { userId: existingByEmail._id, isNewUser: false };
    }

    // 创建新用户
    const newUserId = await ctx.db.insert("users", {
      name: username,
      handle: username,
      displayName: username,
      email,
      image: avatarUrl,
      flarumId,
      flarumUsername: username,
      flarumSyncedAt: now,
      authProvider: "flarum",
      role: "user",
      createdAt: now,
      updatedAt: now,
    });

    return { userId: newUserId, isNewUser: true };
  },
});

/**
 * 同步 Flarum 用户信息（手动触发）
 */
export const syncFlarumProfile = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { success: false, error: "未登录" };
    }

    // 检查是否是 Flarum 用户
    const flarumId = await ctx.runQuery(internal.flarumAuthComplete.getFlarumUserIdInternal, {
      userId,
    });
    
    if (!flarumId) {
      return { success: false, error: "不是 Flarum 用户" };
    }

    // 更新同步时间
    await ctx.runMutation(internal.flarumAuthComplete.updateFlarumSyncTime, {
      userId,
    });

    return { success: true };
  },
});

/**
 * 内部：获取 Flarum 用户ID
 */
export const getFlarumUserIdInternal = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.flarumId ?? null;
  },
});

/**
 * 内部：更新 Flarum 同步时间
 */
export const updateFlarumSyncTime = internalMutation({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      flarumSyncedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return true;
  },
});

/**
 * 内部：创建登录令牌
 */
export const createLoginToken = internalMutation({
  args: { userId: v.id("users") },
  returns: v.string(),
  handler: async (ctx, args) => {
    // 生成随机令牌
    const token = Array.from({ length: 32 }, () => 
      Math.floor(Math.random() * 36).toString(36)
    ).join('');
    
    // 5分钟后过期
    const expiresAt = Date.now() + 5 * 60 * 1000;
    
    await ctx.db.insert("flarumLoginTokens", {
      userId: args.userId,
      token,
      expiresAt,
    });
    
    return token;
  },
});

/**
 * 内部：验证并标记登录令牌
 */
export const verifyAndUseLoginToken = internalMutation({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      userId: v.id("users"),
    }),
    v.object({
      valid: v.literal(false),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("flarumLoginTokens")
      .withIndex("token", (q) => q.eq("token", args.token))
      .unique();
    
    if (!record) {
      return { valid: false as const, error: "Invalid token" };
    }
    
    if (record.usedAt) {
      return { valid: false as const, error: "Token already used" };
    }
    
    if (Date.now() > record.expiresAt) {
      return { valid: false as const, error: "Token expired" };
    }
    
    // 标记为已使用
    await ctx.db.patch(record._id, { usedAt: Date.now() });
    
    return { valid: true as const, userId: record.userId };
  },
});

/**
 * 检查用户是否存在且未被删除/禁用（供 Credentials provider 使用）
 */
export const checkUserActive = internalQuery({
  args: { userId: v.id("users") },
  returns: v.object({
    active: v.boolean(),
    user: v.optional(v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
    })),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.deletedAt || user.deactivatedAt) {
      return { active: false };
    }
    return { 
      active: true, 
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      }
    };
  },
});

/**
 * 验证登录令牌（供 Credentials provider 使用）
 * 
 * 注意：在 authorize 回调中使用，只能读取不能修改数据。
 * Token 的过期由时间控制（5分钟），不需要立即标记为已使用。
 */
export const verifyLoginToken = internalQuery({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      userId: v.id("users"),
    }),
    v.object({
      valid: v.literal(false),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args): Promise<{ valid: true; userId: Id<"users"> } | { valid: false; error: string }> => {
    const record = await ctx.db
      .query("flarumLoginTokens")
      .withIndex("token", (q) => q.eq("token", args.token))
      .unique();
    
    if (!record) {
      return { valid: false as const, error: "Invalid token" };
    }
    
    if (record.usedAt) {
      return { valid: false as const, error: "Token already used" };
    }
    
    if (Date.now() > record.expiresAt) {
      return { valid: false as const, error: "Token expired" };
    }
    
    return { valid: true as const, userId: record.userId };
  },
});
