import { z } from 'zod';

// TrackItem can be any JSON object
export const trackItemSchema = z.record(z.any());

// Segment schema (groupId removed from input)
export const segmentSchema = z.object({
  id: z.string(),
  start: z.number(),
  end: z.number(),
  name: z.string(),
  isSelected: z.boolean().optional().default(false),
  isClone: z.boolean().optional().default(false),
  trackItem: trackItemSchema,
});

export type SegmentInput = z.infer<typeof segmentSchema>;
