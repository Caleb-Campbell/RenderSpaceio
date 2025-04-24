import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server"; // Import UploadThingError
import { getSessionUser } from "../auth/session";

const f = createUploadthing();

export const uploadRouter = {
  // Define the full image uploader logic directly here
  imageUploader: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      // Get user from session to verify authentication
      const user = await getSessionUser();
 
      if (!user) throw new Error("Unauthorized");
 
      // Return user data to be available in onUploadComplete
      return { userId: user.id };
    })
    .onUploadError(({ error }: { error: UploadThingError }) => { // Moved before onUploadComplete
      // This code runs on upload error
      console.error("Upload error:", error.message); // Log the error message
      // UploadThing handles sending the error response to the client.
    })
    .onUploadComplete(async ({ metadata, file }) => { // Moved to be the last callback
      // This code runs after upload completes
      console.log("Upload complete for userId:", metadata.userId);
      console.log("File URL:", file.url);

      return { fileUrl: file.url, userId: metadata.userId };
    }),
}; // Removed 'satisfies FileRouter'

export type OurFileRouter = typeof uploadRouter;
