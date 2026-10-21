import { db } from "@/lib/db";

// Plain server helpers (not Server Actions): exporting them from a "use server"
// file would make them callable from the browser.
export const getUserById = async (id: string) => {
  try {
    return await db.user.findUnique({ where: { id } });
  } catch (error) {
    console.log(error);
    return null;
  }
};
