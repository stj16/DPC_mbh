import express from "express";
import prisma from "../prismaClient.js";
import { authMiddleware } from "../middleware/auth.js";
import { blockchainService } from "../services/blockchain.js";
import { coingeckoService } from "../services/coingecko.js";

const router = express.Router();

/**
 * POST /api/withdraw
 * Relayer backend libère les fonds on-chain et simule Mobile Money
 */
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { transferId } = req.body;
        const recipientId = req.user.id;

        if (!transferId) {
            return res.status(400).json({ error: "transferId requis" });
        }

        const transfer = await prisma.transfer.findUnique({ where: { transferId } });
        if (!transfer) return res.status(404).json({ error: "Transfert introuvable" });

        // Vérifier que le current user est le bon destinataire
        const me = await prisma.user.findUnique({ where: { id: recipientId } });
        if (transfer.recipientPhone !== me.phone) {
            return res.status(403).json({ error: "Ce transfert ne vous est pas destiné" });
        }

        if (transfer.status !== "LOCKED") {
            return res.status(400).json({ error: `Transfert impossible à retirer (status: ${transfer.status})` });
        }

        // 1. Libération On-chain (Le backend utilise sa clef relayer)
        try {
            const txHash = await blockchainService.releaseTransferOnChain(transferId);

            // 2. Mise à jour statut DB
            await prisma.transfer.update({
                where: { transferId },
                data: { status: "RELEASED" } // Idéalement, puis "WITHDRAWN" après mobile money
            });

            // 3. Simulation Mobile Money (XOF)
            const rates = await coingeckoService.getExchangeRates();
            // On retire les frais des 0.1%
            const netAmountUsdc = transfer.amountUsdc - transfer.feeUsdc;
            const amountXof = Math.floor(netAmountUsdc * rates.usdcToXof);

            console.log(`===============================================`);
            console.log(`💸 [MOBILE MONEY SIMULATION - MTN/MOOV BENIN]`);
            console.log(`✅ ${amountXof} FCFA envoyés à ${me.phone}`);
            console.log(`   TxHash Libération: ${txHash}`);
            console.log(`===============================================`);

            res.json({
                message: "Fonds retirés avec succès (Simulation Mobile Money)",
                amountXof,
                txHash
            });

        } catch (bcError) {
            console.error("Release Blockchain Error:", bcError);
            res.status(500).json({ error: "Erreur lors de la libération blockchain des fonds" });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

export default router;
