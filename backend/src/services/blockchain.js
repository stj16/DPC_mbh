import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Chargement des adresses de contrats (issues du déploiement) ──
const addressesPath = path.join(__dirname, "..", "..", "contract-addresses.json");
let diasporaContractAddress = process.env.DIASPORA_CONTRACT_ADDRESS;
let usdcContractAddress = process.env.USDC_CONTRACT_ADDRESS;

if (fs.existsSync(addressesPath)) {
    const data = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    diasporaContractAddress = data.contracts.DiasporaTransfer.address;
    usdcContractAddress = data.contracts.MockUSDC.address;
}

const rpcUrl = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Relayer = le wallet du backend, qui a les droits de "release"
const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
const relayerWallet = relayerPrivateKey ? new ethers.Wallet(relayerPrivateKey, provider) : null;

// ABI basique pour MockUSDC (ERC-20)
const usdcAbi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
];

// ABI basique pour DiasporaTransfer
const diasporaAbi = [
    "function initiateTransfer(string calldata transferId, address recipient, uint256 amount) external",
    "function releaseTransfer(string calldata transferId) external",
    "function getTransfer(string calldata transferId) external view returns (tuple(address sender, address recipient, uint256 amount, uint256 fee, uint256 createdAt, uint256 releasedAt, uint8 status, string transferId))"
];

/**
 * Service Blockchain pour interagir avec Polygon Amoy
 */
export const blockchainService = {
    getProvider() {
        return provider;
    },

    /**
     * Créer un nouveau wallet Ethereum (pour les users)
     */
    createWallet() {
        const wallet = ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
        };
    },

    /**
     * Initier un transfert depuis le wallet de l'expéditeur
     */
    async initiateTransferOnChain(senderPrivateKey, transferId, recipientAddress, amountUsdcStr) {
        const senderWallet = new ethers.Wallet(senderPrivateKey, provider);
        const amountStr = amountUsdcStr.toString();
        // 6 décimales pour USDC
        const amount = ethers.parseUnits(amountStr, 6);

        const usdcContract = new ethers.Contract(usdcContractAddress, usdcAbi, senderWallet);
        const diasporaContract = new ethers.Contract(diasporaContractAddress, diasporaAbi, senderWallet);

        // 1. Approve USDC pour le contrat Diaspora
        const approveTx = await usdcContract.approve(diasporaContractAddress, amount);
        await approveTx.wait();

        // 2. Initiate Transfer
        const transferTx = await diasporaContract.initiateTransfer(transferId, recipientAddress, amount);
        const receipt = await transferTx.wait();

        return receipt.hash;
    },

    /**
     * Libérer les fonds (appelé par le backend Relayer)
     */
    async releaseTransferOnChain(transferId) {
        if (!relayerWallet) throw new Error("Relayer wallet not configured");

        const diasporaContract = new ethers.Contract(diasporaContractAddress, diasporaAbi, relayerWallet);
        const tx = await diasporaContract.releaseTransfer(transferId);
        const receipt = await tx.wait();

        return receipt.hash;
    }
};
