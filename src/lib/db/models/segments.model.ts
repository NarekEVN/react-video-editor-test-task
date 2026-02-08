import { Schema, model, models } from "mongoose";

// Segment schema
const SegmentSchema = new Schema(
  {
    id: { type: String, required: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    groupId: { type: String, required: true },
    name: { type: String, required: true },
    isSelected: { type: Boolean, default: false },
    isClone: { type: Boolean, default: false },
    trackItem: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

// Avoid OverwriteModelError in dev/hot reload
export const SegmentModel = models.Segment || model("Segment", SegmentSchema);
