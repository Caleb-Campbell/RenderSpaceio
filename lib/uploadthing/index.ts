import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getSessionUser } from "../auth/session";
 
const f = createUploadthing();
 
export const uploadRouter = {
  // Define image upload routes
  imageUploader: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      // Get user from session to verify authentication
      const user = await getSessionUser();
 
      if (!user) throw new Error("Unauthorized");
 
      // Return user data to be available in onUploadComplete
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code runs after upload completes
      console.log("Upload complete for userId:", metadata.userId);
      console.log("File URL:", file.url);
 
      return { fileUrl: file.url, userId: metadata.userId };
    }),
} satisfies FileRouter;
 
export type OurFileRouter = typeof uploadRouter;