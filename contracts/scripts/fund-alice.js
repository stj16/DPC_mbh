import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const aliceWallet = fs.readFileSync("../backend/alice_wallet.txt", "utf8").trim();
  const [deployer] = await hre.ethers.getSigners();
  
  // 1. Envoyer 0.1 MATIC
  const tx = await deployer.sendTransaction({
    to: aliceWallet,
    value: hre.ethers.parseEther("0.1")
  });
  await tx.wait();
  console.log(`✅ 0.1 MATIC envoyés à Alice (${aliceWallet})`);

  // 2. Envoyer 1000 USDC
  const addressesPath = path.join(__dirname, "..", "contract-addresses.json");
  const data = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = MockUSDC.attach(data.contracts.MockUSDC.address);
  
  const tx2 = await usdc.faucet(aliceWallet, 1000);
  await tx2.wait();
  console.log(`✅ 1000 USDC_test envoyés à Alice`);
}

main().catch(console.error);
