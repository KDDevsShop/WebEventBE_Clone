import { prisma } from "../prisma/prisma.js";
import { calculateAverageRating } from './service.utils.js';
import { createValidationResult, handleError } from '../utils/validation.js';

export const advancedSearchServicesQuery = async (searchParams = {}) => {
  try {
    const { query, filters, facets, page, limit, sortBy = 'relevance', sortOrder = 'desc' } = searchParams;
    if (!query?.trim()) return createValidationResult(false, ['Search query is required.']);

    const where = {
      OR: [
        { service_name: { contains: query.trim(), mode: 'insensitive' } },
        { description: { contains: query.trim(), mode: 'insensitive' } },
        
        { service_type: { service_type_name: { contains: query.trim(), mode: 'insensitive' } } },
      ],
      is_active: true,
      ...filters,
    };

    const include = {
      images: true,
      service_type: true,
      variations: { select: { variation_id: true, variation_name: true, base_price: true } },
      reviews: { select: { rate: true } },
    };

    const pageNum = Number(page) > 0 ? Number(page) : 1;
    const limitNum = Number(limit) > 0 ? Number(limit) : 10;
    const skip = (pageNum - 1) * limitNum;
    const orderBy = sortBy !== 'relevance'
      ? { [sortBy]: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc' }
      : undefined; // We'll sort by relevance in JS

    const [services, totalCount, facetData] = await Promise.all([
      prisma.service.findMany({
        where,
        include,
        skip,
        take: limitNum,
        ...(orderBy && { orderBy }),
      }),
      prisma.service.count({ where }),
      Array.isArray(facets) && facets.includes('service_type')
        ? prisma.service.groupBy({
            by: ['service_type_id'],
            where: { ...where, service_type_id: { not: null } },
            _count: true,
            orderBy: { _count: { service_type_id: 'desc' } },
          })
        : Promise.resolve([]),
    ]);

    let processedServices = services.map(service => ({
      ...service,
      averageRating: calculateAverageRating(service.reviews),
      reviewCount: service.reviews?.length || 0,
      variationCount: service.variations?.length || 0,
      tags: service.tags ? service.tags.split(',').filter(Boolean) : [],
      relevanceScore: calculateRelevanceScore(service, query),
    }));

    // Sort by relevance if requested
    if (sortBy === 'relevance') {
      processedServices = processedServices.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    return createValidationResult(true, [], {
      services: processedServices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
        hasPreviousPage: pageNum > 1,
      },
      facets: facetData.length ? { service_types: facetData } : {},
      searchQuery: query,
      suggestions: await generateSearchSuggestions(query),
    });
  } catch (error) {
    return handleError('advancedSearchServicesQuery', error);
  }
};

export const calculateRelevanceScore = (service, query) => {
  let score = 0;
  const queryLower = query?.toLowerCase() || '';
  if (service.service_name?.toLowerCase().includes(queryLower)) score += 10;
  if (service.description?.toLowerCase().includes(queryLower)) score += 5;
  if (service.tags?.toLowerCase().includes(queryLower)) score += 3;
  score += Math.min((service.reviews?.length || 0) * 0.1, 2);
  return score;
};

export const generateSearchSuggestions = async (query) => {
  try {
    if (!query || query.trim().length < 2) return [];
    const suggestions = await prisma.service.findMany({
      where: {
        service_name: { contains: query, mode: 'insensitive' },
        is_active: true,
      },
      select: { service_name: true },
      take: 5,
    });
    return suggestions.map(s => s.service_name);
  } catch (error) {
    return [];
  }
};