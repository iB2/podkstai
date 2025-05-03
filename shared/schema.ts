import { pgTable, text, serial, integer, boolean, timestamp, jsonb, foreignKey, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Tabela de usuários atualizada para Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  username: varchar("username").unique().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  bio: text("bio"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  podcasts: many(podcasts),
}));

// Schema para upsert de usuários
export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true
});

export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

export const podcasts = pgTable("podcasts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  author: text("author").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  language: text("language").default("en").notNull(),
  audioUrl: text("audio_url").notNull(),
  coverImageUrl: text("cover_image_url"),
  duration: integer("duration").notNull(),
  chunkCount: integer("chunk_count").notNull(),
  fileSize: integer("file_size").notNull(),
  conversation: text("conversation").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  metadata: jsonb("metadata")
});

export const podcastsRelations = relations(podcasts, ({ one, many }) => ({
  user: one(users, {
    fields: [podcasts.userId],
    references: [users.id],
  }),
  audioChunks: many(podcastAudioChunks),
}));

export const insertPodcastSchema = createInsertSchema(podcasts).omit({
  id: true,
  createdAt: true,
});

export type InsertPodcast = z.infer<typeof insertPodcastSchema>;
export type Podcast = typeof podcasts.$inferSelect;

export const podcastAudioChunks = pgTable("podcast_audio_chunks", {
  id: serial("id").primaryKey(),
  podcastId: integer("podcast_id").notNull().references(() => podcasts.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  audioUrl: text("audio_url").notNull(),
  duration: integer("duration").notNull(),
  fileSize: integer("file_size").notNull(),
  text: text("text").notNull(),
  speakerMap: jsonb("speaker_map"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const podcastAudioChunksRelations = relations(podcastAudioChunks, ({ one }) => ({
  podcast: one(podcasts, {
    fields: [podcastAudioChunks.podcastId],
    references: [podcasts.id],
  }),
}));

export const insertPodcastAudioChunkSchema = createInsertSchema(podcastAudioChunks).omit({
  id: true,
  createdAt: true,
});

export type InsertPodcastAudioChunk = z.infer<typeof insertPodcastAudioChunkSchema>;
export type PodcastAudioChunk = typeof podcastAudioChunks.$inferSelect;
