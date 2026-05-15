import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import authRoutes from "./routes/auth.js";
import transferRoutes from "./routes/transfer.js";
import ratesRoutes from "./routes/rates.js";
import transactionsRoutes from "./routes/transactions.js";
import withdrawRoutes from "./routes/withdraw.js";

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(s => s.trim())
    : ["http://localhost:3000", "http://localhost:5000", "http://localhost:8080"];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all in dev/hackathon mode
        }
    },
    credentials: true
}));

app.use(express.json());

// Logger simple
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Routes API DiasporaConnect
app.use("/api/auth", authRoutes);
app.use("/api/transfer", transferRoutes);
app.use("/api/rates", ratesRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/withdraw", withdrawRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "DiasporaConnect API",
        version: "1.0.0",
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get("/", (req, res) => {
    res.json({
        service: "DiasporaConnect API",
        docs: "/api/health",
        endpoints: [
            "POST /api/auth/register",
            "POST /api/auth/verify-otp",
            "POST /api/transfer",
            "POST /api/withdraw",
            "GET /api/rates",
            "GET /api/transactions"
        ]
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`DiasporaConnect Backend running on http://0.0.0.0:${PORT}`);
});
