// app/api/selection-groups/[id]/route.ts
import { NextRequest } from "next/server";
import { withMongo } from "@/lib/db/withMongo";
import { SelectionGroupModel, SegmentModel } from "@/lib/db/models";
import { generateId } from "@designcombo/timeline";

export const GET = withMongo(
  async (_req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const params = await context.params;
    const groupId = params.id;

    // Fetch group with populated segments
    const group = await SelectionGroupModel.findOne({ id: groupId })
      .populate({ path: "segments", options: { sort: { start: 1 } } }) // sort segments by start time
      .lean();

    if (!group) {
      throw new Error("Group not found")
    }

    return {
      groupId: group.id,
      name: group.name,
      description: group.description,
      videoUrl: group.videoUrl,
      thumbnail: group.thumbnail,
      segments: group.segments || [],
      meta: {
        segmentCount: (group.segments?.length || 0),
        totalDuration: group.duration || 7445,
      },
    };
  }
);


// PUT - Update existing group
export const PUT = withMongo(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const params = await context.params;
    const groupId = params.id;

    const body = await req.json();
    const { name, segments, videoUrl, description } = body;

    if (!segments || !Array.isArray(segments)) {
      throw new Error("Invalid segments data")
    }

    // Check if group exists in DB
    const existingGroup = await SelectionGroupModel.findOne({ id: groupId });

    if (!existingGroup) {
      // If mock group, create new custom group
      const newGroup = await SelectionGroupModel.create({
        id: generateId(),
        name: name || `Modified ${groupId}`,
        description,
        videoUrl,
        thumbnail: body.thumbnail,
        segmentCount: segments.length,
        duration: body.duration,
      });

      // Add segments to DB
      const segmentsToInsert = segments.map((seg: any) => ({
        ...seg,
        groupId: newGroup.id,
        id: generateId(),
      }));

      await SegmentModel.insertMany(segmentsToInsert);

      return {
        success: true,
        group: newGroup,
        message: "Created new custom group based on mock group",
      };
    }

    // Update existing group
    existingGroup.name = name ?? existingGroup.name;
    existingGroup.description = description ?? existingGroup.description;
    existingGroup.videoUrl = videoUrl ?? existingGroup.videoUrl;
    existingGroup.thumbnail = body.thumbnail ?? existingGroup.thumbnail;
    existingGroup.segmentCount = segments.length;
    existingGroup.duration = body.duration ?? existingGroup.duration;

    await existingGroup.save();

    // Remove old segments and insert new ones
    await SegmentModel.deleteMany({ groupId });
    const segmentsToInsert = segments.map((seg: any) => ({
      ...seg,
      groupId,
      id: generateId(),
    }));
    await SegmentModel.insertMany(segmentsToInsert);

      return {
      success: true,
      group: existingGroup,
      message: "Selection group updated successfully",
    };
  } catch (error: any) {
    console.error("[API] Error updating group:", error);
    throw new Error("Failed to update selection group");
  }
});
