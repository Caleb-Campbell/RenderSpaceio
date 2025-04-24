import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server"; // Import UploadThingError and UTApi
import { getSessionUser } from "../auth/session";

const f = createUploadthing();

// Initialize the UploadThing API client for server-side uploads
const utapi = new UTApi();

// --- Moved from lib/openai/index.ts ---
/**
 * Saves an image buffer to UploadThing
 * @param imageBuffer The image data as a Buffer
 * @param filename The desired filename for the uploaded image
 * @returns The UploadThing URL for the saved image
 */
async function uploadBufferToUploadThing(imageBuffer: Buffer, filename: string): Promise<string> {
  try {
    // For development without API keys, use a placeholder
    if (process.env.NODE_ENV !== "production" && !process.env.UPLOADTHING_SECRET) {
      console.log("[uploadBufferToUploadThing] UploadThing not configured in development, using placeholder");
      return '/placeholder-render.jpg';
    }

    console.log(`[uploadBufferToUploadThing] Uploading image buffer: ${imageBuffer.length} bytes as ${filename}`);

    // Attempt UploadThing upload
    try {
      console.log("[uploadBufferToUploadThing] Attempting UploadThing upload with buffer...");
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      const file = new File([blob], filename, { type: 'image/png' });
      const uploadResult = await utapi.uploadFiles(file);

      if (uploadResult.error) {
        throw new Error(`UploadThing error: ${uploadResult.error.message}`); // Access error message
      }

      if (!uploadResult.data?.url) {
        throw new Error('UploadThing did not return a URL.');
      }

      console.log("[uploadBufferToUploadThing] UploadThing success:", uploadResult.data.url);
      return uploadResult.data.url;
    } catch (utError) {
      console.error("[uploadBufferToUploadThing] UploadThing upload failed:", utError);
      // Throw the error instead of returning a local fallback
     throw utError; // Re-throws the error
    }
  } catch (error) { // Outer catch
    console.error('[uploadBufferToUploadThing] Error during upload buffer process:', error);
    // Re-throw the error so the caller knows the upload failed
    throw error;
  }
}
// --- End Moved Function ---


// --- New Function and Type ---

// Define the result type for the upload operation
export type UploadResult = {
  success: boolean;
  imageUrl?: string;
  error?: string;
};

// Define input type for uploadRenderedImage
type UploadRenderedImageParams = {
  imageData: string; // Base64 encoded image data
  userId?: number | string; // Optional: for filename generation or logging
  filenamePrefix?: string; // Optional: prefix for filename
};

/**
 * Decodes base64 image data and uploads it to UploadThing.
 * @param params Parameters including base64 imageData and optional context.
 * @returns An object containing the upload result (URL) or error.
 */
export async function uploadRenderedImage(params: UploadRenderedImageParams): Promise<UploadResult> {
  const { imageData, userId = 'unknown', filenamePrefix = 'render' } = params;
  console.log(`[uploadRenderedImage] Starting upload for user ${userId}.`);

  try {
    // 1. Decode base64 to buffer
    const imageBuffer = Buffer.from(imageData, 'base64');
    console.log(`[uploadRenderedImage] Decoded base64 image to buffer: ${imageBuffer.length} bytes`);

    // 2. Generate filename
    const filename = `${filenamePrefix}_${Date.now()}_${userId}.png`;
    console.log(`[uploadRenderedImage] Generated filename: ${filename}`);

    // 3. Call the upload function
    const imageUrl = await uploadBufferToUploadThing(imageBuffer, filename);
    console.log(`[uploadRenderedImage] Upload successful. URL: ${imageUrl}`);

    return {
      success: true,
      imageUrl: imageUrl,
    };

  } catch (error) {
    console.error('[uploadRenderedImage] Error during upload:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload rendered image.',
    };
  }
}

// --- End New Function and Type ---

export const uploadRouter = {
  // Define the full image uploader logic directly here
  imageUploader: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      console.log("UploadThing: Starting middleware check...");
      // Get user from session to verify authentication
      const user = await getSessionUser();
      console.log("UploadThing: Fetched user session.");
 
      if (!user) {
        console.error("UploadThing: Middleware check failed - Unauthorized.");
        throw new Error("Unauthorized");
      }
      console.log("UploadThing: Middleware check passed for userId:", user.id);
 
      // Return user data to be available in onUploadComplete
      return { userId: user.id };
    })
    .onUploadError(({ error }: { error: UploadThingError }) => { // Moved before onUploadComplete
      console.log("UploadThing: Entering onUploadError callback...");
      // This code runs on upload error
      console.error("UploadThing: Upload error occurred:", error.message, error.cause); // Log the error message and cause
      // UploadThing handles sending the error response to the client.
      console.log("UploadThing: Exiting onUploadError callback.");
    })
    .onUploadComplete(async ({ metadata, file }) => { // Moved to be the last callback
      console.log("UploadThing: Entering onUploadComplete callback...");
      // This code runs after upload completes
      console.log("UploadThing: Upload complete for userId:", metadata.userId);
      console.log("UploadThing: File URL:", file.url);
      console.log("UploadThing: File details:", file); // Log the full file object

      // Potentially add database update logic here if needed

      console.log("UploadThing: Exiting onUploadComplete callback.");
      return { fileUrl: file.url, userId: metadata.userId };
    }),
}; // Removed 'satisfies FileRouter'

export type OurFileRouter = typeof uploadRouter; // Keep existing router export
