/**
 * Script Faucet — Distribue des USDC de test
 * ===========================================
 * Après le déploiement, ce script distribue des USDC de test
 * aux adresses que tu veux tester.
 *
 * Utilisation :
 *   npx hardhat run scripts/faucet.js --network amoy
 */

import hre from "hardhat";
const { ethers } = hre;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const [deployer] = await ethers.getSigners();

    // Lecture des adresses déployées
    const addressFile = path.join(__dirname, "..", "contract-addresses.json");
    if (!fs.existsSync(addressFile)) {
        console.error("❌ contract-addresses.json introuvable. Lancez d'abord deploy.js");
        process.exit(1);
    }

    const { contracts } = JSON.parse(fs.readFileSync(addressFile, "utf8"));
    const usdcAddress = contracts.MockUSDC.address;

    console.log(`\n💧 Faucet MockUSDC : ${usdcAddress}`);

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = MockUSDC.attach(usdcAddress);

    // Distribution de 1000 USDC au déployeur
    const amount = 1000; // 1000 USDC
    const tx = await usdc.faucet(deployer.address, amount);
    await tx.wait();

    console.log(`✅ ${amount} USDC de test distribués à : ${deployer.address}`);
    console.log(`   TxHash : ${tx.hash}\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
