/**
 * Script de déploiement DiasporaConnect
 * ======================================
 * Déploie dans cet ordre :
 *   1. MockUSDC.sol        — Token USDC simulé (ERC-20)
 *   2. DiasporaTransfer.sol — Contrat principal de transfert
 *
 * Utilisation :
 *   # Réseau local (tests)
 *   npx hardhat run scripts/deploy.js
 *
 *   # Polygon Amoy Testnet
 *   npx hardhat run scripts/deploy.js --network amoy
 *
 * Pré-requis pour Amoy :
 *   - Avoir du MATIC de test (faucet.polygon.technology)
 *   - Avoir rempli le fichier .env avec PRIVATE_KEY et AMOY_RPC_URL
 */

import hre from "hardhat";
const { ethers } = hre;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║   DiasporaConnect — Déploiement des contrats  ║");
    console.log("╚══════════════════════════════════════════════╝\n");

    // ── Informations réseau ─────────────────────────────────────────────────
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log(`📡 Réseau     : ${network.name} (ChainId: ${network.chainId})`);
    console.log(`👤 Déployeur  : ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance    : ${ethers.formatEther(balance)} MATIC\n`);

    if (balance === 0n) {
        console.error("❌ Erreur : Balance MATIC insuffisante pour déployer.");
        console.error("   → Obtenez du MATIC de test sur : https://faucet.polygon.technology/");
        process.exit(1);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  ÉTAPE 1 : Déploiement de MockUSDC
    // ══════════════════════════════════════════════════════════════════════
    console.log("🚀 Étape 1/2 : Déploiement de MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    const usdcAddress = await mockUSDC.getAddress();
    console.log(`✅ MockUSDC déployé : ${usdcAddress}`);

    // ══════════════════════════════════════════════════════════════════════
    //  ÉTAPE 2 : Déploiement de DiasporaTransfer
    // ══════════════════════════════════════════════════════════════════════
    console.log("\n🚀 Étape 2/2 : Déploiement de DiasporaTransfer...");

    // Le relayer = l'adresse du déployeur (sera mis à jour avec l'adresse du backend)
    const relayerAddress = deployer.address;

    const DiasporaTransfer = await ethers.getContractFactory("DiasporaTransfer");
    const diasporaTransfer = await DiasporaTransfer.deploy(usdcAddress, relayerAddress);
    await diasporaTransfer.waitForDeployment();

    const contractAddress = await diasporaTransfer.getAddress();
    console.log(`✅ DiasporaTransfer déployé : ${contractAddress}`);

    // ══════════════════════════════════════════════════════════════════════
    //  SAUVEGARDE DES ADRESSES
    // ══════════════════════════════════════════════════════════════════════
    const deploymentInfo = {
        network: network.name,
        chainId: network.chainId.toString(),
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            MockUSDC: {
                address: usdcAddress,
                description: "Token USDC simulé pour les tests",
            },
            DiasporaTransfer: {
                address: contractAddress,
                description: "Contrat principal de transfert diaspora",
                relayer: relayerAddress,
            },
        },
    };

    // Sauvegarde locale dans contracts/
    const deployFile = path.join(__dirname, "..", "contract-addresses.json");
    fs.writeFileSync(deployFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n📄 Adresses sauvegardées dans : contract-addresses.json`);

    // Copie dans le backend pour que les APIs puissent lire les adresses
    const backendDir = path.join(__dirname, "..", "..", "backend");
    if (fs.existsSync(backendDir)) {
        const backendFile = path.join(backendDir, "contract-addresses.json");
        fs.writeFileSync(backendFile, JSON.stringify(deploymentInfo, null, 2));
        console.log(`📄 Copié dans backend/contract-addresses.json`);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  RÉSUMÉ FINAL
    // ══════════════════════════════════════════════════════════════════════
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║                   DÉPLOIEMENT RÉUSSI ✅                      ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║  MockUSDC          : ${usdcAddress}  ║`);
    console.log(`║  DiasporaTransfer  : ${contractAddress}  ║`);
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log("║  PROCHAINES ÉTAPES :                                         ║");
    console.log("║  1. Copiez ces adresses dans backend/.env                    ║");
    console.log("║  2. Obtenez des USDC de test : npx hardhat run scripts/faucet.js --network amoy  ║");
    if (network.chainId === 80002n) {
        console.log(`║  3. Voir sur Polygonscan : https://amoy.polygonscan.com/address/${contractAddress}  ║`);
    }
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Erreur lors du déploiement :", error);
        process.exit(1);
    });
