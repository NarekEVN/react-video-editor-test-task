import { z } from 'zod';
import { segmentSchema } from './segment.schema';

export const createSelectionGroupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
  thumbnail: z.string().optional(),
  segments: z.array(segmentSchema).min(1, "Segments array cannot be empty"),
  duration: z.number().optional(),
});

export type CreateSelectionGroupInput = z.infer<typeof createSelectionGroupSchema>;
