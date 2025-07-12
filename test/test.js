// import express from "express";

// const router = express.Router();

// // Basic response function - no imports
// const basicResponse = (res, status, message, data = null) => {
//     res.status(status).json({
//         success: status < 400,
//         message,
//         data
//     });
// };

// // Mock middleware - no imports
// const mockAuth = (req, res, next) => next();

// // ==================== TEST ROUTES ====================
// router.get("/health", (req, res) => {
//     basicResponse(res, 200, "Health check");
// });

// router.get("/test", (req, res) => {
//     basicResponse(res, 200, "Basic test");
// });

// // Test the problematic route patterns
// router.get("/filter/price/:min/:max", mockAuth, (req, res) => {
//     basicResponse(res, 200, "Price filter", {
//         min: req.params.min,
//         max: req.params.max
//     });
// });

// router.get("/by-type/:serviceTypeId", (req, res) => {
//     basicResponse(res, 200, "Service by type", {
//         serviceTypeId: req.params.serviceTypeId
//     });
// });

// router.get("/:serviceId", (req, res) => {
//     basicResponse(res, 200, "Service by ID", {
//         serviceId: req.params.serviceId
//     });
// });

// export default router;