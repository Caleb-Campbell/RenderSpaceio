import OpenAI from 'openai';
import fs from 'fs/promises'; // Use promises for async file reading
import path from 'path'; // Import path module
import fetch from 'node-fetch'; // Keep for potential fallbacks or other uses
import { UTApi } from 'uploadthing/server';
import { Readable } from 'stream';

// Initialize OpenAI client only if API key is available
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// Initialize the UploadThing API client
const utapi = new UTApi();

// File types for UploadThing
type FileWithPath = {
  filepath: string;
  type: string;
  name: string;
};

type RenderParams = {
  inputImagePath: string; // Renamed from collageImagePath
  roomType: string;
  lighting: string;
  userId: string;
};

/**
 * Saves a remote image to UploadThing
 * Saves an image buffer to UploadThing
 * @param imageBuffer The image data as a Buffer
 * @param filename The desired filename for the uploaded image
 * @returns The UploadThing URL for the saved image
 */
async function uploadBufferToUploadThing(imageBuffer: Buffer, filename: string): Promise<string> {
  try {
    // For development without API keys, use a placeholder
    if (process.env.NODE_ENV !== "production" && !process.env.UPLOADTHING_SECRET) {
      console.log("UploadThing not configured in development, using placeholder");
      return '/placeholder-render.jpg';
    }

    console.log(`Uploading image buffer: ${imageBuffer.length} bytes as ${filename}`);

    // Save the file locally as a fallback/debug measure
    const publicDir = path.join(process.cwd(), 'public/uploads');
    await fs.mkdir(publicDir, { recursive: true }); // Use async mkdir
    const localFilePath = path.join(publicDir, filename);
    await fs.writeFile(localFilePath, imageBuffer); // Use async writeFile
    console.log(`Saved fallback file locally to: ${localFilePath}`);

    // Attempt UploadThing upload
    try {
      console.log("Attempting UploadThing upload with buffer...");
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      const file = new File([blob], filename, { type: 'image/png' });
      const uploadResult = await utapi.uploadFiles(file);

      if (uploadResult.error) {
        throw new Error(`UploadThing error: ${uploadResult.error.message}`); // Access error message
      }

      if (!uploadResult.data?.url) {
        throw new Error('UploadThing did not return a URL.');
      }

      console.log("UploadThing success:", uploadResult.data.url);
      return uploadResult.data.url;
    } catch (utError) {
      console.error("UploadThing upload failed:", utError);
      // Return the local file path as fallback
      const fallbackUrl = `/uploads/${filename}`;
      console.log(`Using fallback local URL: ${fallbackUrl}`);
      return fallbackUrl;
    }
  } catch (error) {
    console.error('Error in uploadBufferToUploadThing:', error);
    // Provide a generic placeholder on error during upload process
    return '/placeholder-render.jpg';
  }
}

/**
 * Generates an interior design visualization using OpenAI's DALL-E 3 model
 * @param params The parameters for the render request
 * @returns An object containing the render result or error
 */
export async function generateRender(params: RenderParams): Promise<RenderResult> {
  try {
    // Check if OpenAI is properly initialized
    if (!openai) {
      console.warn('OpenAI API key not configured. Using mock response.');
      // Return mock response for development/build without API key
      return {
        success: true,
        inputImageUrl: params.inputImagePath, // Use inputImagePath
        generatedImageUrl: '/placeholder-render.jpg',
        prompt: `Created a photorealistic interior design visualization of a ${params.roomType} with ${params.lighting} lighting, using the design elements from the uploaded collage.`,
      };
    }

    // --- Use images.edit endpoint ---

    // 1. Get the input image buffer (fetch from URL or read from local path)
    let imageBuffer: Buffer;
    try {
      const imagePath = params.inputImagePath; // Use inputImagePath
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        // Fetch image from URL
        console.log(`Fetching input image from URL: ${imagePath}`);
        const response = await fetch(imagePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch image from ${imagePath}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        console.log(`Fetched input image: ${imageBuffer.length} bytes`);
      } else {
        // Assume it's a local path (relative to project root)
        const fullImagePath = path.join(process.cwd(), imagePath);
        console.log(`Reading input image from local path: ${fullImagePath}`);
        imageBuffer = await fs.readFile(fullImagePath);
        console.log(`Read input image: ${imageBuffer.length} bytes`);
      }
    } catch (fetchOrReadError) {
      console.error(`Error getting input image (${params.inputImagePath}):`, fetchOrReadError); // Use inputImagePath
      throw new Error(`Failed to get input image: ${params.inputImagePath}`); // Use inputImagePath
    }

    // 2. Create the prompt for editing
    const prompt = `Transform this collage image into a photorealistic interior design visualization of a ${params.roomType} with ${params.lighting} lighting. Maintain the key design elements, patterns, and style from the collage but render it as a realistic 3D scene.`;
    
    // 3. Make the API call to OpenAI images.edit
    let image_base64: string | undefined;
    const apiParams = {
      model: "gpt-image-1", // Using a placeholder model name as per original code
      prompt: prompt,
      n: 1, 
      size: "1024x1024" as const, // Specify desired size using 'as const' for literal type
    };
    console.log("Calling OpenAI images.edit API with params:", { ...apiParams, image: `[File object for ${params.inputImagePath}]` }); // Log params without image data

    try {
      // The OpenAI SDK expects a File-like object (like the browser File API) or ReadStream.
      // Create a File object from the buffer.
      const imageName = `input_collage_${Date.now()}.png`;
      const imageBlob = new Blob([imageBuffer], { type: 'image/png' }); // Assuming PNG, adjust if needed
      const imageFile = new File([imageBlob], imageName, { type: 'image/png' });

      console.log(`Sending imageFile: name=${imageFile.name}, size=${imageFile.size}, type=${imageFile.type}`);

      const response = await openai.images.edit({
        ...apiParams, // Spread the defined parameters
        image: imageFile, // Pass the created File object
      });

      console.log("Received OpenAI images.edit response structure:", JSON.stringify(response, null, 2)); // Log the full response structure

      // Get the base64 image data from the response
      image_base64 = response.data[0]?.b64_json; // Use optional chaining
      if (!image_base64) {
        console.error("OpenAI response missing b64_json:", response);
        throw new Error('No b64_json in OpenAI images.edit response data[0]');
      }
      console.log("OpenAI images.edit successfully generated base64 data (first 60 chars):", image_base64.substring(0, 60) + "...");

    } catch (openaiError: any) { // Type error as any to access properties
      console.error("OpenAI API error (images.edit):", openaiError);
      // Log more details if available (e.g., response status, error message)
      if (openaiError.response) {
        console.error("OpenAI API Error Response Status:", openaiError.response.status);
        console.error("OpenAI API Error Response Data:", openaiError.response.data);
      } else {
        console.error("OpenAI API Error Message:", openaiError.message);
      }
      
      // In development, fall back to placeholder if OpenAI call fails
      if (process.env.NODE_ENV !== "production") {
        console.warn("Using placeholder image due to OpenAI API error");
        return {
          success: true,
          inputImageUrl: params.inputImagePath, // Use inputImagePath
          generatedImageUrl: '/placeholder-render.jpg',
          prompt,
        };
      }
      
      // Re-throw in production
      throw openaiError; // Re-throw after logging
    }

    // 4. Decode base64 and prepare buffer
    const generatedImageBuffer = Buffer.from(image_base64, 'base64');
    console.log(`Decoded generated image: ${generatedImageBuffer.length} bytes`);

    // 5. Generate a unique filename
    const filename = `render_${Date.now()}_${params.userId}.png`;

    // 6. Upload the generated image buffer to UploadThing
    try {
      const permanentImageUrl = await uploadBufferToUploadThing(generatedImageBuffer, filename);

      // Return the result with the permanent URL
      return {
        success: true,
        inputImageUrl: params.inputImagePath, // Use inputImagePath
        generatedImageUrl: permanentImageUrl,
        prompt, // Include the prompt used
      };
    } catch (uploadError) {
      console.error("Error uploading buffer to UploadThing:", uploadError);

      // If UploadThing fails, return error status (or potentially the local fallback URL if desired)
      return {
        success: false,
        error: `Failed to upload generated image: ${uploadError instanceof Error ? uploadError.message : 'Unknown upload error'}`,
        prompt, // Include prompt even on upload failure
      };
    }
  } catch (error) {
    console.error('Error generating render:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate render. Please try again later.',
    };
  }
}

// Type for render result
export type RenderResult = {
  success: boolean;
  inputImageUrl?: string; // Renamed from originalImageUrl
  generatedImageUrl?: string;
  prompt?: string;
  error?: string;
  uploadError?: string; // Keep for potential upload-specific errors
};

export async function uploadImage(fileUrl: string) {
  // This function now just returns the URL from uploadthing
  try {
    return {
      success: true,
      imagePath: fileUrl,
    };
  } catch (error) {
    console.error('Error processing uploaded image:', error);
    return {
      success: false,
      error: 'Failed to process uploaded image. Please try again.',
    };
  }
}
