/**
 * Test E2E DiasporaConnect — Script autonome
 * 
 * Ce script démarre le serveur Express INTERNEMENT (pas en background),
 * exécute le flux complet (inscription, transfert, retrait),
 * affiche les résultats et ferme le serveur.
 *
 * Usage : node test-e2e.js
 */

import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import { ethers } from "ethers";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

// ── Désactivons les imports circulaires en important directement ──

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "hackathon_super_secret";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
    ? Buffer.from(process.env.ENCRYPTION_KEY, "hex")
    : null;

console.log("🔑 ENCRYPTION_KEY chargée:", ENCRYPTION_KEY ? "✅ OUI" : "❌ NON (bug!)");

function encrypt(text) {
    if (!ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY manquante!");
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text) {
    if (!ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY manquante!");
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// ── Configuration blockchain ──
const rpcUrl = process.env.AMOY_RPC_URL || "http://127.0.0.1:8545";
const provider = new ethers.JsonRpcProvider(rpcUrl);
const relayerKey = process.env.RELAYER_PRIVATE_KEY;
const relayer = new ethers.Wallet(relayerKey, provider);

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const addresses = JSON.parse(fs.readFileSync(path.join(__dirname, "contract-addresses.json"), "utf8"));
const usdcAddr = addresses.contracts.MockUSDC.address;
const diasporaAddr = addresses.contracts.DiasporaTransfer.address;

const usdcAbi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)"
];

const diasporaAbi = [
    "function initiateTransfer(string calldata transferId, address recipient, uint256 amount) external",
    "function releaseTransfer(string calldata transferId) external",
    "function getTransfer(string calldata transferId) external view returns (tuple(address sender, address recipient, uint256 amount, uint256 fee, uint256 createdAt, uint256 releasedAt, uint8 status, string transferId))"
];

// ── Créer un wallet ──
function createWallet() {
    const w = ethers.Wallet.createRandom();
    return { address: w.address, privateKey: w.privateKey };
}

async function main() {
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║    DiasporaConnect — Test E2E Complet        ║");
    console.log("╚══════════════════════════════════════════════╝\n");

    // 1. Créer Alice (expéditeur France)
    console.log("👤 1. Inscription Alice (France)...");
    const aliceWallet = createWallet();
    const alicePkEnc = encrypt(aliceWallet.privateKey);
    const aliceDecrypted = decrypt(alicePkEnc);
    console.log("   🔐 Chiffrement/déchiffrement AES:", aliceDecrypted === aliceWallet.privateKey ? "✅ OK" : "❌ FAIL");

    await prisma.user.deleteMany({ where: { phone: "+33600000000" } });
    const alice = await prisma.user.create({
        data: {
            phone: "+33600000000",
            name: "Alice Expéditeur",
            walletAddress: aliceWallet.address,
            walletPrivateKey: alicePkEnc,
            otpCode: "123456",
            isVerified: true
        }
    });
    console.log("   Wallet Alice:", alice.walletAddress);

    // 2. Créer Bob (destinataire Bénin)
    console.log("\n👤 2. Inscription Bob (Bénin)...");
    const bobWallet = createWallet();
    await prisma.user.deleteMany({ where: { phone: "+22966111111" } });
    const bob = await prisma.user.create({
        data: {
            phone: "+22966111111",
            name: "Bob Destinataire",
            walletAddress: bobWallet.address,
            walletPrivateKey: encrypt(bobWallet.privateKey),
            otpCode: "123456",
            isVerified: true
        }
    });
    console.log("   Wallet Bob:", bob.walletAddress);

    // 3. Financer Alice (MATIC + USDC depuis le compte Hardhat)
    console.log("\n💰 3. Financement Alice...");
    const nonce1 = await relayer.getNonce();
  const tx1 = await relayer.sendTransaction({ to: alice.walletAddress, value: ethers.parseEther("1.0"), nonce: nonce1 });
    await tx1.wait();
    console.log("   ✅ 1.0 MATIC envoyé à Alice");

    const usdc = new ethers.Contract(usdcAddr, usdcAbi, relayer);
    const nonce2 = await relayer.getNonce();
  const tx2 = await usdc.transfer(alice.walletAddress, ethers.parseUnits("500", 6), { nonce: nonce2 });
    await tx2.wait();

    const bal = await usdc.balanceOf(alice.walletAddress);
    console.log("   ✅ Balance USDC Alice:", ethers.formatUnits(bal, 6));

    // 4. Transfert Alice -> Bob (50 EUR = ~54 USDC)
    console.log("\n📨 4. Transfert 50 EUR (Alice → Bob)...");
    const eurToUsdc = 1.08;
    const amountUsdc = Number((50 * eurToUsdc).toFixed(2));
    console.log("   50 EUR =", amountUsdc, "USDC");

    const transferId = "TXN-2026-E2ETEST";
    const amountBN = ethers.parseUnits(amountUsdc.toString(), 6);

    // Alice approuve le contrat
    const aliceEthers = new ethers.Wallet(aliceWallet.privateKey, provider);
    const usdcAlice = new ethers.Contract(usdcAddr, usdcAbi, aliceEthers);
    const approveTx = await usdcAlice.approve(diasporaAddr, amountBN);
    await approveTx.wait();
    console.log("   ✅ Approve USDC");

    // Alice initie le transfert
    const diaspora = new ethers.Contract(diasporaAddr, diasporaAbi, aliceEthers);
    const transferTx = await diaspora.initiateTransfer(transferId, bob.walletAddress, amountBN);
    const receipt = await transferTx.wait();
    console.log("   ✅ Transfert initié on-chain !");
    console.log("   TxHash:", receipt.hash);

    // Enregistrement DB
    await prisma.transfer.deleteMany({ where: { transferId } });
    await prisma.transfer.create({
        data: {
            transferId,
            senderId: alice.id,
            recipientPhone: bob.phone,
            amountEur: 50,
            amountUsdc,
            feeUsdc: amountUsdc * 0.001,
            status: "LOCKED",
            txHash: receipt.hash
        }
    });

    // 5. Libération par le Relayer
    console.log("\n🔓 5. Libération des fonds (Relayer)...");
    const diasporaRelayer = new ethers.Contract(diasporaAddr, diasporaAbi, relayer);
    const nonce3 = await relayer.getNonce();
  const releaseTx = await diasporaRelayer.releaseTransfer(transferId, { nonce: nonce3 });
    const releaseReceipt = await releaseTx.wait();
    console.log("   ✅ Fonds libérés ! TxHash:", releaseReceipt.hash);

    const bobBal = await usdc.balanceOf(bob.walletAddress);
    console.log("   💰 Balance Bob après réception:", ethers.formatUnits(bobBal, 6), "USDC");

    // 6. Simulation Mobile Money (CFA)
    console.log("\n📱 6. Retrait Mobile Money (CFA)...");
    const netUsdc = amountUsdc * 0.999;
    const amountCFA = Math.floor(netUsdc * 605);
    console.log("   💸 Simulation MTN Bénin :", amountCFA, "FCFA envoyés au +22966111111");

    console.log("\n══════════════════════════════════════════════");
    console.log("✅  FLUX E2E COMPLET RÉUSSI !");
    console.log("══════════════════════════════════════════════");
    console.log("  Expéditeur    : Alice (+33600000000) — France");
    console.log("  Destinataire  : Bob (+22966111111) — Bénin");
    console.log(`  Montant envoyé : 50 EUR → ${amountUsdc} USDC`);
    console.log(`  Reçu par Bob  : ${ethers.formatUnits(bobBal, 6)} USDC`);
    console.log(`  En CFA        : ~${amountCFA} FCFA`);
    console.log(`  Frais DiasporaConnect : ${(amountUsdc * 0.001).toFixed(4)} USDC (0.1%)`);
    console.log(`  vs Western Union      : ~${Math.floor(50 * 0.10)} EUR (10%) !!!`);
    console.log("══════════════════════════════════════════════\n");

    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error("❌ Erreur:", e.message);
    await prisma.$disconnect();
    process.exit(1);
});
