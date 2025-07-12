const { sendResponse } = require("./response");

// This assumes you're storing the role somewhere on the request object.
// If you're using Prisma's Role enum, just ensure the enum check logic remains intact.
const checkRole = (requiredRole) => {
    return (req, res, next) => {
        if (!req.userId || !req.role || !requiredRole.includes(req.role)) {
            console.log("Role check failed", req.userId, req.role, requiredRole);
            return sendResponse(res, 403, "Forbidden - Bạn không có quyền truy cập tài nguyên này");
        }
        next();
    };
};

module.exports = {
    checkRole,
};
