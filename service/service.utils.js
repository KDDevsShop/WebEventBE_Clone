import { uploadImage, getTransformedImageUrl } from '../utils/cloudinary.js';
import { createValidationResult } from '../utils/validation.js';


export const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return createValidationResult(false, [error.message]);
};


export const handleImageUpload = async (imageFile, publicId) => {
  if (!imageFile) return null;
  try {
    const uploadResult = await uploadImage(imageFile.buffer, `services`, publicId, {
      width: 800,
      height: 600,
      crop: 'fill',
      quality: 'auto',
    });
    return uploadResult;
  } catch (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }
};


export const calculateAverageRating = (reviews) => {
  if (!reviews?.length) return 0;
  const sum = reviews.reduce((acc, review) => acc + Number(review.rating), 0);
  return Math.round((sum / reviews.length) * 10) / 10;
};


export const getServiceStatistics = async (serviceId) => {
  try {
    const [variationCount, imageCount, reviewCount, priceRange] = await Promise.all([
      prisma.serviceVariation.count({ where: { service_id: serviceId } }),
      prisma.image.count({ where: { service_id: serviceId } }),
      prisma.review.count({ where: { service_id: serviceId } }),
      prisma.serviceVariation.aggregate({
        where: { service_id: serviceId },
        _min: { base_price: true },
        _max: { base_price: true },
      }),
    ]);

    return {
      totalVariations: variationCount,
      totalImages: imageCount,
      totalReviews: reviewCount,
      priceRange: variationCount > 0 ? {
        min: Number(priceRange._min.base_price),
        max: Number(priceRange._max.base_price),
      } : null,
    };
  } catch (error) {
    throw new Error(`Error in getServiceStatistics: ${error.message}`);
  }
};
