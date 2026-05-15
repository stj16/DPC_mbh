import express from "express";
import prisma from "../prismaClient.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/transactions
 * Renvoie l'historique des transferts (envoyés et reçus)
 */
router.get("/", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const userPhone = req.user.phone;

        // Récupère les transferts où l'utilisateur est soit expéditeur, soit destinataire
        const transactions = await prisma.transfer.findMany({
            where: {
                OR: [
                    { senderId: userId },
                    { recipientPhone: userPhone }
                ]
            },
            orderBy: { createdAt: "desc" },
            include: {
                sender: {
                    select: { name: true, phone: true }
                }
            }
        });

        res.json(transactions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

export default router;
