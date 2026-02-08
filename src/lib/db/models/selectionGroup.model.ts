import { Schema, model, models } from "mongoose";

const SelectionGroupSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    segmentCount: { type: Number },
    thumbnail: { type: String },
    videoUrl: { type: String },
    duration: { type: Number },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual populate for segments
SelectionGroupSchema.virtual("segments", {
  ref: "Segment",
  localField: "id",
  foreignField: "groupId",
});

export const SelectionGroupModel =
  models.SelectionGroup || model("SelectionGroup", SelectionGroupSchema);

