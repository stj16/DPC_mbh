# 🔧 Documentation Technique - Backend DiasporaConnect

## Structure du Projet

```
backend/
├── prisma/
│   ├── schema.prisma    # Schema de base de donnees
│   └── dev.db       # Base SQLite (dev)
├── src/
│   ├── index.js     # Point d'entree Express
│   ├── routes/
│   │   ├── auth.js      # Authentification
│   │   ├── transfer.js # Transferts
│   │   └── wallet.js  # Portefeuille
│   ├── services/
│   │   ├── blockchain.js  # Integration blockchain
│   │   └── currency.js    # Taux de change
│   └── middleware/
│       └── auth.js    # Verification JWT
└── package.json
```

## Installation

```bash
cd backend
npm install
npx prisma migrate dev
npm start
```

## API Endpoints

### Sante
```bash
GET /api/health
# Retourne: { status: "ok", service: "DiasporaConnect API" }
```

### Taux de Change
```bash
GET /api/rates
# Retourne: { eurToUsdc: 1.08, usdcToXof: 605, eurToXof: 655.95 }
```

### Inscription
```bash
POST /api/auth/register
Body: { name: "Nom", phone: "+33780000001", pin: "1234" }
Retourne: { message: "OTP envoyé", phone: "+33780000001" }
```

### Verification OTP
```bash
POST /api/auth/verify-otp
Body: { phone: "+33780000001", otpCode: "123456" }
Retourne: { token: "JWT...", user: { id, name, phone, walletAddress } }
```

### Transfert
```bash
POST /api/transfer
Headers: Authorization: Bearer <token>
Body: { amountEur: 50, recipientPhone: "+22966111111" }
Retourne: { transferId, txHash, amountUsdc, status, simulation }
```

### Transactions
```bash
GET /api/transactions
Headers: Authorization: Bearer <token>
Retourne: [{ id, amountEur, recipientPhone, status, createdAt }]
```

## Blockchain (Polygon)

### Configuration
```javascript
// contracts/.env
RPC_URL=http://localhost:8545
PRIVATE_KEY=0x...  // Cle privee du deployer
CONTRACT_ADDRESS=0x...
```

### Smart Contract
- **Token**: USDC sur Polygon
- **Frais**: 0.8%
- **Delai**: < 30 minutes

## Base de Donnees (Prisma)

### Modeles
```prisma
model User {
  id            String  @id @default(uuid())
  name          String
  phone         String  @unique
  pinHash       String
  walletAddress String
  createdAt     DateTime @default(now())
}

model Transaction {
  id              String   @id @default(uuid())
  senderId        String
  recipientPhone  String
  amountEur      Float
  amountUsdc     Float
  feeUsdc        Float
  status         String   // LOCKED, COMPLETED, FAILED
  txHash         String?
  createdAt      DateTime @default(now())
}
```

## Simulation Mode

Si blockchain non disponible:
- Les transferts fonctionnent en mode simule
- `status: "LOCKED"`
- `simulation: true`
- Transaction enregistree en base

## Pour Production

1. **Deployer smart contract** sur Polygon mainnet
2. **Configurer** RPC_URL vers Polygon节点
3. **Utiliser** PostgreSQL au lieu de SQLite
4. **Ajouter** verification KYC
5. **Integrer** MTN MoMo / Moov API

## Smart Contract

### Fichiers
```
contracts/
├── contracts/
│   ├── DiasporaTransfer.sol  # Contrat principal
│   └── MockUSDC.sol      # Token USDC mock
├── scripts/
│   └── deploy.js        # Script de deploiement
└── test/
    └── Transfer.js    # Tests
```

### DiasporaTransfer.sol
```solidity
// Fonctionnalites:
// - transferToBenin() - Transfert vers Benin
// - withdraw() - Retrait vers Mobile Money
// - payBill() - Paiement factures
// - Frais: 0.8%
```

### Commandes
```bash
# Compile
npx hardhat compile

# Deploy local
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# Test
npx hardhat test
```

## Commandes Utiles

```bash
# Dev
npm start           # Server sur port 3000
npx prisma studio  # Interface DB

# Blockchain
cd ../contracts
npx hardhat node  # Local blockchain
npx hardhat test  # Tests
```