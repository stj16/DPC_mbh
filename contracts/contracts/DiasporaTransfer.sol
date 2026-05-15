// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DiasporaTransfer
 * @author DiasporaConnect — MIABE Hackathon 2026
 * @notice Smart contract de transfert de fonds pour la diaspora béninoise.
 *         Permet d'envoyer des USDC depuis la diaspora vers des bénéficiaires au Bénin.
 *
 * @dev Flux en 5 étapes :
 *   1. DÉPÔT      : L'expéditeur appelle initiateTransfer() avec les USDC
 *   2. VERROUILLAGE: Les fonds sont bloqués dans le contrat (status = LOCKED)
 *   3. VÉRIFICATION: Le backend vérifie que le destinataire est enregistré
 *   4. LIBÉRATION : releaseTransfer() envoie les USDC au wallet destinataire
 *   5. RETRAIT    : Le backend convertit USDC→CFA et simule Mobile Money
 *
 * Réseau : Polygon Amoy Testnet (ChainId 80002)
 */
contract DiasporaTransfer is Ownable, ReentrancyGuard {

    // ═══════════════════════════════════════════════════════════════════════
    //  TYPES & CONSTANTES
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Frais de plateforme en points de base (10 = 0.1%)
    uint256 public constant PLATFORM_FEE_BPS = 10;
    uint256 public constant BPS_DENOMINATOR   = 10_000;

    /// @notice États possibles d'un transfert
    enum TransferStatus {
        LOCKED,     // Fonds déposés et bloqués
        RELEASED,   // Fonds libérés au destinataire
        CANCELLED   // Transfert annulé, fonds remboursés
    }

    /// @notice Structure d'un transfert
    struct Transfer {
        address sender;          // Adresse wallet de l'expéditeur
        address recipient;       // Adresse wallet du destinataire
        uint256 amount;          // Montant USDC (en unités avec 6 décimales)
        uint256 fee;             // Frais USDC prélevés par la plateforme
        uint256 createdAt;       // Timestamp de création (block.timestamp)
        uint256 releasedAt;      // Timestamp de libération (0 si pas encore)
        TransferStatus status;   // État du transfert
        string transferId;       // ID unique (généré côté backend)
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ÉTAT DU CONTRAT
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Contrat ERC-20 USDC utilisé pour les transferts
    IERC20 public immutable usdc;

    /// @notice Adresse du backend (seul autorisé à appeler release/cancel)
    address public relayer;

    /// @notice Mapping transferId → Transfer
    mapping(string => Transfer) private _transfers;

    /// @notice Mapping sender → liste de ses transferIds
    mapping(address => string[]) private _senderTransfers;

    /// @notice Mapping recipient → liste de ses transferIds
    mapping(address => string[]) private _recipientTransfers;

    /// @notice Total des frais collectés (en USDC avec 6 décimales)
    uint256 public totalFeesCollected;

    // ═══════════════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Émis quand un transfert est initié et les fonds bloqués
    event TransferInitiated(
        string indexed transferId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 fee,
        uint256 timestamp
    );

    /// @notice Émis quand les fonds sont libérés au destinataire
    event TransferReleased(
        string indexed transferId,
        address indexed recipient,
        uint256 netAmount,
        uint256 timestamp
    );

    /// @notice Émis quand un transfert est annulé et remboursé
    event TransferCancelled(
        string indexed transferId,
        address indexed sender,
        uint256 refundAmount,
        uint256 timestamp
    );

    /// @notice Émis quand l'adresse relayer change
    event RelayerUpdated(address oldRelayer, address newRelayer);

    // ═══════════════════════════════════════════════════════════════════════
    //  MODIFICATEURS
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyRelayer() {
        require(
            msg.sender == relayer || msg.sender == owner(),
            "DiasporaTransfer: caller is not the relayer or owner"
        );
        _;
    }

    modifier transferExists(string calldata transferId) {
        require(
            _transfers[transferId].sender != address(0),
            "DiasporaTransfer: transfer does not exist"
        );
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  CONSTRUCTEUR
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @param _usdc     Adresse du contrat USDC (MockUSDC sur testnet, vrai USDC en prod)
     * @param _relayer  Adresse du backend autorisé à libérer/annuler les transferts
     */
    constructor(address _usdc, address _relayer) Ownable(msg.sender) {
        require(_usdc != address(0), "DiasporaTransfer: invalid USDC address");
        require(_relayer != address(0), "DiasporaTransfer: invalid relayer address");
        usdc = IERC20(_usdc);
        relayer = _relayer;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ÉTAPE 1 & 2 : DÉPÔT + VERROUILLAGE
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Initie un transfert : l'expéditeur dépose des USDC dans le contrat.
     *         Les fonds sont immédiatement bloqués (status = LOCKED).
     *
     * @dev Pré-requis : l'expéditeur doit avoir appelé usdc.approve(contractAddress, amount)
     *      AVANT d'appeler cette fonction.
     *
     * @param transferId ID unique du transfert (généré par le backend, ex: "TXN-2026-00001")
     * @param recipient  Adresse wallet du destinataire au Bénin
     * @param amount     Montant en USDC (avec 6 décimales, ex: 10 USDC = 10_000_000)
     */
    function initiateTransfer(
        string calldata transferId,
        address recipient,
        uint256 amount
    ) external nonReentrant {
        // ── Vérifications ──────────────────────────────────────────────────
        require(bytes(transferId).length > 0, "DiasporaTransfer: empty transferId");
        require(recipient != address(0), "DiasporaTransfer: invalid recipient");
        require(amount > 0, "DiasporaTransfer: amount must be > 0");
        require(
            _transfers[transferId].sender == address(0),
            "DiasporaTransfer: transferId already used"
        );
        require(
            msg.sender != recipient,
            "DiasporaTransfer: sender cannot be recipient"
        );

        // ── Calcul des frais (0.1%) ────────────────────────────────────────
        uint256 fee = (amount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netAmount = amount - fee;

        // ── Transfert ERC-20 : prélève amount depuis l'expéditeur ─────────
        // L'expéditeur doit avoir fait approve() au préalable
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "DiasporaTransfer: USDC transferFrom failed");

        // ── Enregistrement du transfert (LOCKED) ──────────────────────────
        _transfers[transferId] = Transfer({
            sender:      msg.sender,
            recipient:   recipient,
            amount:      netAmount, // montant net (après frais)
            fee:         fee,
            createdAt:   block.timestamp,
            releasedAt:  0,
            status:      TransferStatus.LOCKED,
            transferId:  transferId
        });

        _senderTransfers[msg.sender].push(transferId);
        _recipientTransfers[recipient].push(transferId);
        totalFeesCollected += fee;

        emit TransferInitiated(
            transferId,
            msg.sender,
            recipient,
            netAmount,
            fee,
            block.timestamp
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ÉTAPE 3 & 4 : VÉRIFICATION + LIBÉRATION
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Libère les fonds au destinataire.
     *         Appelé par le backend (relayer) après vérification que le destinataire
     *         est bien enregistré dans la base de données.
     *
     * @dev La vérification (étape 3) est faite off-chain par le backend avant cet appel.
     *      Le backend confirme que phone ↔ walletAddress est valide.
     *
     * @param transferId ID du transfert à libérer
     */
    function releaseTransfer(string calldata transferId)
        external
        onlyRelayer
        nonReentrant
        transferExists(transferId)
    {
        Transfer storage t = _transfers[transferId];

        require(
            t.status == TransferStatus.LOCKED,
            "DiasporaTransfer: transfer is not in LOCKED status"
        );

        // ── Mise à jour du statut ──────────────────────────────────────────
        t.status = TransferStatus.RELEASED;
        t.releasedAt = block.timestamp;

        // ── Envoi des USDC au destinataire ────────────────────────────────
        bool success = usdc.transfer(t.recipient, t.amount);
        require(success, "DiasporaTransfer: USDC transfer to recipient failed");

        emit TransferReleased(transferId, t.recipient, t.amount, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ANNULATION & REMBOURSEMENT
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Annule un transfert et rembourse l'expéditeur.
     *         Peut être appelé par le relayer (backend) ou l'expéditeur lui-même
     *         (seulement après un délai de 24h).
     *
     * @param transferId ID du transfert à annuler
     */
    function cancelTransfer(string calldata transferId)
        external
        nonReentrant
        transferExists(transferId)
    {
        Transfer storage t = _transfers[transferId];

        require(
            t.status == TransferStatus.LOCKED,
            "DiasporaTransfer: can only cancel LOCKED transfers"
        );

        // Le relayer/owner peut annuler à tout moment
        // L'expéditeur peut annuler après 24h d'attente
        if (msg.sender != relayer && msg.sender != owner()) {
            require(
                msg.sender == t.sender,
                "DiasporaTransfer: not authorized to cancel"
            );
            require(
                block.timestamp >= t.createdAt + 24 hours,
                "DiasporaTransfer: must wait 24h before self-cancellation"
            );
        }

        // ── Mise à jour du statut ──────────────────────────────────────────
        t.status = TransferStatus.CANCELLED;

        // ── Remboursement : amount net + frais (montant total original) ────
        uint256 refundAmount = t.amount + t.fee;
        totalFeesCollected -= t.fee; // Remboursement des frais aussi

        bool success = usdc.transfer(t.sender, refundAmount);
        require(success, "DiasporaTransfer: USDC refund failed");

        emit TransferCancelled(transferId, t.sender, refundAmount, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  LECTURE (VIEW FUNCTIONS)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Retourne les détails complets d'un transfert.
     */
    function getTransfer(string calldata transferId)
        external
        view
        returns (Transfer memory)
    {
        return _transfers[transferId];
    }

    /**
     * @notice Retourne tous les IDs de transferts d'un expéditeur.
     */
    function getSenderTransfers(address sender)
        external
        view
        returns (string[] memory)
    {
        return _senderTransfers[sender];
    }

    /**
     * @notice Retourne tous les IDs de transferts d'un destinataire.
     */
    function getRecipientTransfers(address recipient)
        external
        view
        returns (string[] memory)
    {
        return _recipientTransfers[recipient];
    }

    /**
     * @notice Calcule les frais pour un montant donné (utilitaire off-chain).
     * @param amount Montant USDC (avec 6 décimales)
     * @return fee       Frais prélevés
     * @return netAmount Montant net reçu par le destinataire
     */
    function calculateFee(uint256 amount)
        external
        pure
        returns (uint256 fee, uint256 netAmount)
    {
        fee = (amount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        netAmount = amount - fee;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ADMINISTRATION
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Met à jour l'adresse du relayer (backend).
     */
    function setRelayer(address newRelayer) external onlyOwner {
        require(newRelayer != address(0), "DiasporaTransfer: invalid relayer");
        emit RelayerUpdated(relayer, newRelayer);
        relayer = newRelayer;
    }

    /**
     * @notice Retire les frais collectés vers le propriétaire du contrat.
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = totalFeesCollected;
        require(amount > 0, "DiasporaTransfer: no fees to withdraw");
        totalFeesCollected = 0;
        bool success = usdc.transfer(owner(), amount);
        require(success, "DiasporaTransfer: fee withdrawal failed");
    }
}
