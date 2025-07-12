import jwt from 'jsonwebtoken';

export function isAdmin(req) {
  return req.user && req.user.role && req.user.role.toLowerCase() === "admin";
}


export const isStaffOrAdmin = (req) => {
  return req.user && (req.user.role === "admin" || req.user.role === "staff");
};


export const extractAndVerifyToken = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return null;
  }
};


export const isAuthenticated = (req) => {
  return !!req.user;
};


export const isResourceOwnerOrAdmin = (req, resourceUserId) => {
  return (req.user && (req.user.id === resourceUserId || req.user.role === "admin"));
};