import express from "express";
import { coingeckoService } from "../services/coingecko.js";

const router = express.Router();

/**
 * GET /api/rates
 * Renvoie les taux actuels EUR/USDC et USDC/XOF
 */
router.get("/", async (req, res) => {
    try {
        const rates = await coingeckoService.getExchangeRates();
        res.json(rates);
    } catch (error) {
        res.status(500).json({ error: "Impossible de récupérer les taux" });
    }
});

export default router;
