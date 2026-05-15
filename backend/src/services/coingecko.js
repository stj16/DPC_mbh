import axios from "axios";

// Cache pour éviter de surcharger l'API gratuite de CoinGecko
let cachedRates = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 60000; // 1 minute

export const coingeckoService = {
    /**
     * Récupère les taux de change EUR -> USDC et USDC -> XOF
     */
    async getExchangeRates() {
        const now = Date.now();
        if (cachedRates && (now - lastFetchTime) < CACHE_DURATION_MS) {
            return cachedRates;
        }

        try {
            // usd = proxy pour usdc (stablecoin)
            // On demande eur et xof en fonction du USD
            const response = await axios.get(
                "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=eur,xof"
            );

            const data = response.data["usd-coin"];
            if (!data) throw new Error("Impossible de récupérer les taux");

            // USDC vaut ~1 USD. On a USDC -> EUR et USDC -> XOF
            // Pour EUR -> USDC = 1 / data.eur
            const eurToUsdc = 1 / data.eur;
            const usdcToXof = data.xof;

            cachedRates = {
                eurToUsdc: Number(eurToUsdc.toFixed(4)),
                usdcToXof: Number(usdcToXof.toFixed(2)),
                eurToXof: Number((eurToUsdc * usdcToXof).toFixed(2)), // Taux indicatif global
                updatedAt: new Date().toISOString()
            };

            lastFetchTime = now;
            return cachedRates;
        } catch (error) {
            console.error("Erreur CoinGecko:", error.message);
            // Fallback statique en cas de rate limit ou d'erreur
            return {
                eurToUsdc: 1.08,
                usdcToXof: 605.00,
                eurToXof: 655.95,
                updatedAt: new Date().toISOString()
            };
        }
    }
};
