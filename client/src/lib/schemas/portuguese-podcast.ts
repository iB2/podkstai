import { z } from "zod";

export const portuguesePodcastFormSchema = z.object({
  title: z.string().min(3, {
    message: "O título precisa ter pelo menos 3 caracteres",
  }),
  author: z.string().min(2, {
    message: "O nome do autor precisa ter pelo menos 2 caracteres",
  }),
  description: z.string().min(5, {
    message: "A descrição precisa ter pelo menos 5 caracteres",
  }),
  category: z.string(),
  language: z.string().default("pt-BR"),
  conversation: z.string().min(10, {
    message: "A conversa precisa ter pelo menos 10 caracteres",
  }),
  firstSpeakerVoice: z.string(),
  secondSpeakerVoice: z.string(),
});

export type PortuguesePodcastFormValues = z.infer<typeof portuguesePodcastFormSchema>;