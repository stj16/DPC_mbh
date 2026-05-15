import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../prismaClient.js";
import { blockchainService } from "../services/blockchain.js";
import { twilioService } from "../services/twilio.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "hackathon_super_secret";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : crypto.randomBytes(32);
const IV_LENGTH = 16;

function encrypt(text) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

router.post("/register", async (req, res) => {
  try {
    const { phone, name } = req.body;
    if (!phone || !name) return res.status(400).json({ error: "phone et name requis" });

    const otpCode = generateOTP();
    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      const walletInfo = blockchainService.createWallet();
      const encryptedPk = encrypt(walletInfo.privateKey);
      user = await prisma.user.create({
        data: {
          phone,
          name,
          walletAddress: walletInfo.address,
          walletPrivateKey: encryptedPk,
          otpCode
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { otpCode }
      });
    }

    await twilioService.sendOTP(user.phone, otpCode);
    res.json({ message: "OTP envoyé", phone: user.phone });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otpCode } = req.body;
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
    if (user.otpCode !== otpCode) return res.status(400).json({ error: "Code OTP incorrect" });

    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, otpCode: null }
    });

    const token = jwt.sign({ id: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, walletAddress: user.walletAddress } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
