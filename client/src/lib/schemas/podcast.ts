import { z } from "zod";

export const podcastFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  author: z.string().min(1, "Author name is required").max(100, "Author name is too long"),
  description: z.string().min(1, "Description is required").max(500, "Description is too long"),
  category: z.string().min(1, "Category is required"),
  language: z.string().default("en"),
  firstSpeaker: z.string().min(1, "First speaker voice is required"),
  secondSpeaker: z.string().min(1, "Second speaker voice is required"),
  conversationText: z.string().min(10, "Conversation is too short").max(50000, "Conversation is too long"),
});

export type PodcastFormValues = z.infer<typeof podcastFormSchema>;
