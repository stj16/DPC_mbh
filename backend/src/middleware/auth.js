import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "hackathon_super_secret";

export const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "Token manquant" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, phone }
        next();
    } catch (err) {
        return res.status(401).json({ error: "Token invalide" });
    }
};
