import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

/**
 * Tests unitaires — DiasporaTransfer
 * ====================================
 */
describe("DiasporaTransfer", function () {
  let mockUSDC, diasporaTransfer;
  let owner, sender, recipient, relayer, other;
  const USDC_DECIMALS = 6;
  const toUSDC = (amount) => ethers.parseUnits(amount.toString(), USDC_DECIMALS);

  beforeEach(async function () {
    [owner, sender, recipient, relayer, other] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    const DiasporaTransfer = await ethers.getContractFactory("DiasporaTransfer");
    diasporaTransfer = await DiasporaTransfer.deploy(
      await mockUSDC.getAddress(),
      relayer.address
    );
    await diasporaTransfer.waitForDeployment();

    await mockUSDC.faucet(sender.address, 1000);

    await mockUSDC.connect(sender).approve(
      await diasporaTransfer.getAddress(),
      toUSDC(10000)
    );
  });

  describe("Déploiement", function () {
    it("Doit avoir le bon owner", async function () {
      expect(await diasporaTransfer.owner()).to.equal(owner.address);
    });

    it("Doit avoir la bonne adresse USDC", async function () {
      expect(await diasporaTransfer.usdc()).to.equal(await mockUSDC.getAddress());
    });

    it("Doit avoir le bon relayer", async function () {
      expect(await diasporaTransfer.relayer()).to.equal(relayer.address);
    });
  });

  describe("initiateTransfer()", function () {
    it("Doit bloquer les fonds et émettre TransferInitiated", async function () {
      const amount = toUSDC(100);
      const transferId = "TXN-2026-00001";

      const tx = await diasporaTransfer.connect(sender).initiateTransfer(
        transferId,
        recipient.address,
        amount
      );

      await expect(tx)
        .to.emit(diasporaTransfer, "TransferInitiated")
        .withArgs(
          transferId,
          sender.address,
          recipient.address,
          toUSDC(99.9),
          toUSDC(0.1),
          await ethers.provider.getBlock("latest").then(b => b.timestamp)
        );

      const transfer = await diasporaTransfer.getTransfer(transferId);
      expect(transfer.status).to.equal(0);
      expect(transfer.sender).to.equal(sender.address);
      expect(transfer.recipient).to.equal(recipient.address);
      expect(transfer.fee).to.equal(toUSDC(0.1));
    });

    it("Doit correctement prélever les USDC du sender", async function () {
      const amount = toUSDC(100);
      const balanceBefore = await mockUSDC.balanceOf(sender.address);

      await diasporaTransfer.connect(sender).initiateTransfer(
        "TXN-2026-00002",
        recipient.address,
        amount
      );

      const balanceAfter = await mockUSDC.balanceOf(sender.address);
      expect(balanceBefore - balanceAfter).to.equal(amount);
    });

    it("Doit rejeter un transferId déjà utilisé", async function () {
      await diasporaTransfer.connect(sender).initiateTransfer(
        "TXN-DUPLICATE",
        recipient.address,
        toUSDC(50)
      );

      await expect(
        diasporaTransfer.connect(sender).initiateTransfer(
          "TXN-DUPLICATE",
          recipient.address,
          toUSDC(50)
        )
      ).to.be.revertedWith("DiasporaTransfer: transferId already used");
    });
  });

  describe("releaseTransfer()", function () {
    beforeEach(async function () {
      await diasporaTransfer.connect(sender).initiateTransfer(
        "TXN-TO-RELEASE",
        recipient.address,
        toUSDC(100)
      );
    });

    it("Doit envoyer les USDC net au destinataire", async function () {
      const balanceBefore = await mockUSDC.balanceOf(recipient.address);
      await diasporaTransfer.connect(relayer).releaseTransfer("TXN-TO-RELEASE");
      const balanceAfter = await mockUSDC.balanceOf(recipient.address);
      expect(balanceAfter - balanceBefore).to.equal(toUSDC(99.9));
    });

    it("Doit passer le statut à RELEASED (= 1)", async function () {
      await diasporaTransfer.connect(relayer).releaseTransfer("TXN-TO-RELEASE");
      const transfer = await diasporaTransfer.getTransfer("TXN-TO-RELEASE");
      expect(transfer.status).to.equal(1);
    });
  });

  describe("cancelTransfer()", function () {
    beforeEach(async function () {
      await diasporaTransfer.connect(sender).initiateTransfer(
        "TXN-TO-CANCEL",
        recipient.address,
        toUSDC(100)
      );
    });

    it("Le relayer peut annuler immédiatement", async function () {
      const balanceBefore = await mockUSDC.balanceOf(sender.address);
      await diasporaTransfer.connect(relayer).cancelTransfer("TXN-TO-CANCEL");
      const balanceAfter = await mockUSDC.balanceOf(sender.address);
      expect(balanceAfter - balanceBefore).to.equal(toUSDC(100));
    });
  });

  describe("calculateFee()", function () {
    it("Doit calculer 0.1% de frais correctement", async function () {
      const [fee, netAmount] = await diasporaTransfer.calculateFee(toUSDC(100));
      expect(fee).to.equal(toUSDC(0.1));
      expect(netAmount).to.equal(toUSDC(99.9));
    });
  });
});
