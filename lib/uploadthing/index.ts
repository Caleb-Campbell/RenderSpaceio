import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server"; // Import UploadThingError
import { getSessionUser } from "../auth/session";

const f = createUploadthing();

// Define the full image uploader logic
const imageUploaderLogic = f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
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
    })
    .onUploadError(({ error }: { error: UploadThingError }) => { // Add type annotation
      // This code runs on upload error
      console.error("Upload error:", error.message); // Log the error message
    // UploadThing handles sending the error response to the client.
  });

export const uploadRouter = {
  imageUploader: imageUploaderLogic,
}; // Removed 'satisfies FileRouter'

export type OurFileRouter = typeof uploadRouter;
