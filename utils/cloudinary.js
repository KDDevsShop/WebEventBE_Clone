import cloudinary from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload an image to Cloudinary
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {string} folder - Folder to store the image in
 * @param {string} filename - Filename to use (without extension)
 * @param {Object} options - Additional Cloudinary upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
export const uploadImage = async (fileBuffer, folder, filename, options = {}) => {
  try {
    // Convert buffer to base64 for Cloudinary
    const base64Data = fileBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Data}`;

    const uploadResult = await cloudinary.v2.uploader.upload(dataUri, {
      folder,
      public_id: filename.split('.')[0], // Remove extension from public_id
      resource_type: 'image',
      ...options
    });

    return uploadResult;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - Cloudinary public ID of the image
 * @returns {Promise<Object>} Cloudinary deletion result
 */
export const deleteImageFromCloud = async (publicId) => {
  try {
    const result = await cloudinary.v2.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw new Error(`Cloudinary deletion failed: ${error.message}`);
  }
};

/**
 * Create a Cloudinary transformation URL
 * @param {string} publicId - Cloudinary public ID of the image
 * @param {Object} transformations - Transformation options
 * @returns {string} Transformed image URL
 */
export const getTransformedImageUrl = (publicId, transformations = {}) => {
  return cloudinary.v2.url(publicId, {
    secure: true,
    transformation: transformations
  });
};

export default cloudinary;