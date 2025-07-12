import jwt from "jsonwebtoken";
import { sendResponse} from "./response.js";

export const generateTokenAndSetCookies = (res, user) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        sendResponse(res, 500, "NO JWT SECRET FOUND");
    }

    const token = jwt.sign({ id: user.id, role: user.role }, secret, {
        expiresIn: "7d",
    });
    res.cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",

        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return token;
};

export const verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};

export const generateResetToken = (id) => {
    const secret = process.env.JWT_SECRET;

    return jwt.sign({ id }, secret, { expiresIn: "10m" }); // Expires in 10 minutes
};