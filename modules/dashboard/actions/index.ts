"use server";

import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/actions";
import { revalidatePath } from "next/cache";

async function requireUserId(): Promise<string> {
  const user = await currentUser();
  if (!user?.id) {
    throw new Error("Unauthorized");
  }
  return user.id;
}

export const toggleStarMarked = async (
  playgroundId: string,
  isChecked: boolean
) => {
  const userId = await requireUserId();

  try {
    if (isChecked) {
      await db.starMark.create({
        data: {
          userId,
          playgroundId,
          isMarked: isChecked,
        },
      });
    } else {
      await db.starMark.delete({
        where: {
          userId_playgroundId: {
            userId,
            playgroundId,
          },
        },
      });
    }

    revalidatePath("/dashboard");
    return { success: true, isMarked: isChecked };
  } catch (error) {
    console.error("Error updating star mark:", error);
    return { success: false, error: "Failed to update star mark" };
  }
};

export const getAllPlaygroundForUser = async () => {
  const user = await currentUser();
  // Without a user, `where: { userId: undefined }` would match every playground
  if (!user?.id) return [];

  try {
    const playground = await db.playground.findMany({
      where: {
        userId: user.id,
      },
      include: {
        user: true,
        Starmark: {
          where: {
            userId: user.id,
          },
          select: {
            isMarked: true,
          },
        },
      },
    });

    return playground;
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const createPlayground = async (data: {
  title: string;
  template: "REACT" | "NEXTJS" | "EXPRESS" | "VUE" | "HONO" | "ANGULAR";
  description?: string;
}) => {
  const userId = await requireUserId();

  const { template, title, description } = data;

  try {
    const playground = await db.playground.create({
      data: {
        title: title,
        description: description,
        template: template,
        userId,
      },
    });

    return playground;
  } catch (error) {
    console.log(error);
  }
};

export const deleteProjectById = async (id: string) => {
  const userId = await requireUserId();

  try {
    // deleteMany lets us filter by owner, so users can only delete their own playgrounds
    await db.playground.deleteMany({
      where: {
        id,
        userId,
      },
    });
    revalidatePath("/dashboard");
  } catch (error) {
    console.log(error);
  }
};

export const editProjectById = async (
  id: string,
  data: { title: string; description: string }
) => {
  const userId = await requireUserId();

  try {
    await db.playground.updateMany({
      where: {
        id,
        userId,
      },
      data: { title: data.title, description: data.description },
    });
    revalidatePath("/dashboard");
  } catch (error) {
    console.log(error);
  }
};

export const duplicateProjectById = async (id: string) => {
  const userId = await requireUserId();

  try {
    const originalPlayground = await db.playground.findFirst({
      where: { id, userId },
      // todo: add tempalte files
    });
    if (!originalPlayground) {
      throw new Error("Original playground not found");
    }

    const duplicatedPlayground = await db.playground.create({
      data: {
        title: `${originalPlayground.title} (Copy)`,
        description: originalPlayground.description,
        template: originalPlayground.template,
        userId,

        // todo: add template files
      },
    });

    revalidatePath("/dashboard");
    return duplicatedPlayground;
  } catch (error) {
    console.error("Error duplicating project:", error);
  }
};
