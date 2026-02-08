import { NextRequest } from "next/server";
import { withMongo } from "@/lib/db/withMongo";
import { createSelectionGroupSchema } from "@/lib/schema";
import { SegmentModel, SelectionGroupModel } from "@/lib/db/models";
import { generateId } from "@designcombo/timeline";

export const POST = withMongo(async (req: Request) => {
  try {
    // Parse and validate request body
    const body = await req.json();
   
    const validatedData = createSelectionGroupSchema.parse(body);
    const groupId = generateId();
    // Create new selection group in MongoDB
    const newGroup = await SelectionGroupModel.create({
      id: groupId,
      name: validatedData.name,
      description: validatedData.description,
      segmentCount: validatedData.segments.length,
      thumbnail: validatedData.thumbnail,
      videoUrl: validatedData.videoUrl,
      createdAt: new Date(),
    });

    // 2️⃣ Create segments linked to the group
    const segmentsToInsert = validatedData.segments.map((seg) => ({
      ...seg,
      groupId,
      id: generateId(), 
    }));

    await SegmentModel.insertMany(segmentsToInsert);

    return {
      success: true,
      group: newGroup,
      message: "Selection group created successfully",
    };
  } catch (err: any) {
    console.error("[API] Error creating selection group:", err);
    throw new Error(err.message);
  }
});

export const GET = withMongo(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);

    // Pagination params
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Total count of groups
    const total = await SelectionGroupModel.countDocuments();

    // Fetch paginated groups
    const groups = await SelectionGroupModel.find()
      .sort({ createdAt: -1 }) 
      .skip(skip)
      .limit(limit)
      .lean(); 

    return {
      groups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + groups.length < total,
      },
    };
  } catch (err: any) {
    console.error("[API] Error fetching selection groups:", err);
    throw new Error(err.message || "Failed to fetch groups");
  }
});
