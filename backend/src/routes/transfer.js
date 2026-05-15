import express from "express";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import prisma from "../prismaClient.js";
import { authMiddleware } from "../middleware/auth.js";
import { blockchainService } from "../services/blockchain.js";
import { coingeckoService } from "../services/coingecko.js";

const router = express.Router();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : null;

function decrypt(text) {
    if (!ENCRYPTION_KEY) return text; // Fallback sécu si pas de clé
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

/**
 * POST /api/transfer
 * Initie un transfert (conversion EUR -> USDC et appel smart contract)
 */
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { amountEur, recipientPhone } = req.body;
        const senderId = req.user.id;

        if (!amountEur || !recipientPhone) {
            return res.status(400).json({ error: "amountEur et recipientPhone requis" });
        }

        const sender = await prisma.user.findUnique({ where: { id: senderId } });
        const recipient = await prisma.user.findUnique({ where: { phone: recipientPhone } });

        if (!recipient) {
            return res.status(404).json({ error: "Destinataire non inscrit sur DiasporaConnect" });
        }

        // 1. Obtenir les taux & calculer montant USDC
        const rates = await coingeckoService.getExchangeRates();
        const amountUsdc = Number((amountEur * rates.eurToUsdc).toFixed(2));
        const feeUsdc = amountUsdc * 0.001; // Frais de 0.1%

        // 2. Créer l'enregistrement DB
        const transferId = `TXN-2026-${uuidv4().substring(0, 8)}`;
        const transfer = await prisma.transfer.create({
            data: {
                transferId,
                senderId,
                recipientPhone,
                amountEur,
                amountUsdc,
                feeUsdc,
                status: "INITIATED"
            }
        });

        // 3. Appel Blockchain (avec fallback simulation si echec)
        try {
            const senderPk = decrypt(sender.walletPrivateKey);
            const txHash = await blockchainService.initiateTransferOnChain(
                senderPk,
                transferId,
                recipient.walletAddress,
                amountUsdc
            );

            // Succès on-chain
            await prisma.transfer.update({
                where: { id: transfer.id },
                data: { status: "LOCKED", txHash }
            });

            res.json({
                message: "Transfert initié et bloqué sur la blockchain",
                transferId,
                txHash,
                amountUsdc,
                status: "LOCKED"
            });

        } catch (bcError) {
            console.error("Blockchain error, using simulation mode:", bcError.message);
            
            // Mode simulation - pas de blockchain REQUISE
            const txHashSim = "0x" + Array(64).fill(0).map(() => Math.floor(Math.random()*16).toString(16)).join('');
            
            await prisma.transfer.update({
                where: { id: transfer.id },
                data: { status: "LOCKED", txHash: txHashSim }
            });

            res.json({
                message: "Transfert SIMULE (blockchain non disponible)",
                transferId,
                txHash: txHashSim,
                amountUsdc,
                status: "LOCKED",
                simulation: true
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

export default router;
