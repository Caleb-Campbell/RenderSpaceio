import OpenAI from 'openai';
import fs from 'fs/promises'; // Use promises for async file reading
import path from 'path'; // Import path module
import fetch from 'node-fetch'; // Keep for potential fallbacks or other uses
// Removed UTApi import
import { Readable } from 'stream';

// Initialize OpenAI client only if API key is available
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 180000, // 3-minute timeout
    })
  : null;

// Removed UTApi initialization

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
  userId: string; // Keep userId if needed for context/logging within OpenAI call
};

// Define the result type for the OpenAI call
export type OpenAIResult = {
  success: boolean;
  imageData?: string; // Base64 encoded image data
  prompt?: string;
  error?: string;
};


/**
 * Calls OpenAI to generate an interior design visualization using the images.edit endpoint.
 * @param params The parameters for the render request
 * @returns An object containing the OpenAI result (image data as base64) or error
 */
export async function callOpenAI(params: RenderParams): Promise<OpenAIResult> {
  const { inputImagePath, roomType, lighting, userId } = params;
  console.log(`[callOpenAI] Starting for user ${userId}. Input: ${inputImagePath}`);

  try {
    // Check if OpenAI is properly initialized
    if (!openai) {
      console.warn('[callOpenAI] OpenAI API key not configured. Using mock response.');
      // Return mock response for development/build without API key
      // Generate a placeholder base64 image for testing if needed, or return error/specific flag
      return {
        success: false, // Indicate failure if not configured
        error: 'OpenAI not configured',
        prompt: `Mock prompt for ${roomType} with ${lighting} lighting.`,
      };
    }

    // 1. Get the input image buffer (fetch from URL or read from local path)
    let imageBuffer: Buffer;
    try {
      if (inputImagePath.startsWith('http://') || inputImagePath.startsWith('https://')) {
        console.log(`[callOpenAI] Fetching input image from URL: ${inputImagePath}`);
        const response = await fetch(inputImagePath);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        const fullImagePath = path.join(process.cwd(), inputImagePath);
        console.log(`[callOpenAI] Reading input image from local path: ${fullImagePath}`);
        imageBuffer = await fs.readFile(fullImagePath);
      }
      console.log(`[callOpenAI] Input image buffer size: ${imageBuffer.length} bytes`);
    } catch (fetchOrReadError) {
      console.error(`[callOpenAI] Error getting input image (${inputImagePath}):`, fetchOrReadError);
      throw new Error(`Failed to get input image: ${inputImagePath}`);
    }

    // 2. Create the prompt for editing
    const prompt = `Transform this collage image into a photorealistic interior design visualization of a ${roomType} with ${lighting} lighting. Maintain the key design elements, patterns, and style from the collage but render it as a realistic 3D scene.`;
    console.log(`[callOpenAI] Generated prompt: "${prompt.substring(0, 100)}..."`);

    // 3. Make the API call to OpenAI images.edit
    const apiParams = {
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: "1024x1024" as const,
    };
    console.log(`[callOpenAI] Calling OpenAI images.edit API...`);

    try {
      const imageName = `input_collage_${Date.now()}.png`;
      const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
      const imageFile = new File([imageBlob], imageName, { type: 'image/png' });

      console.log(`[callOpenAI] Sending imageFile: name=${imageFile.name}, size=${imageFile.size}, type=${imageFile.type}`);
      const response = await openai.images.edit({ ...apiParams, image: imageFile });
      console.log(`[callOpenAI] OpenAI images.edit call successful.`);

      const image_base64 = response.data[0]?.b64_json;
      if (!image_base64) {
        console.error("[callOpenAI] OpenAI response missing b64_json:", response);
        throw new Error('No b64_json in OpenAI images.edit response');
      }
      console.log("[callOpenAI] Successfully generated base64 data.");

      // Return success with base64 data and prompt
      return {
        success: true,
        imageData: image_base64,
        prompt: prompt,
      };

    } catch (openaiError: any) {
      console.error(`[callOpenAI] Error during images.edit:`, openaiError);
      if (openaiError.response) {
        console.error("[callOpenAI] Response Status:", openaiError.response.status);
        console.error("[callOpenAI] Response Data:", openaiError.response.data);
      } else {
        console.error("[callOpenAI] Error Message:", openaiError.message);
        if (openaiError.code === 'ETIMEDOUT' || openaiError.message?.includes('timeout')) {
          console.error("[callOpenAI] Request timed out.");
        }
      }
      // Return failure status
      return {
        success: false,
        error: `OpenAI API error: ${openaiError.message || 'Unknown error'}`,
        prompt: prompt, // Include prompt even on failure
      };
    }
  } catch (error) {
    console.error('[callOpenAI] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error during OpenAI call.',
    };
  }
}


// Removed deprecated generateRender function and RenderResult type

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
