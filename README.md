# LumniX - DiasporaConnect

<p align="center">
  <img src="https://img.shields.io/badge/MIABE-Hackathon-2026-orange" alt="MIABE 2026">
  <img src="https://img.shields.io/badge/Blockchain-Polygon-blue" alt="Polygon">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

## Description

**DiasporaConnect** est une plateforme innovante de transfert de fonds internationaux construite sur la blockchain Polygon, permettant à la diaspora africaine d'envoyer de l'argent vers le Bénin avec des frais réduits à **0.8%** et une réception en Mobile Money (MTN MoMo, Moov Money) en moins de 30 minutes.

## 🚀 Fonctionnalités Principales

### Pour les Expediteurs (Diaspora)
- 📱 **Authentification sans mot de passe** par OTP SMS
- 💰 **Calcul automatique des frais** et conversion en temps réel
- ⛓️ **Transfert sécurisé** via smart contract Polygon
- 📋 **Suivi en temps réel** avec ID de transaction

### Pour les Bénéficiaires (Bénin)
- 📥 **Recherche de transfert** par téléphone ou ID
- 💵 **Retrait en Mobile Money** (MTN MoMo / Moov Money)
- 📄 **Paiement de factures** (SBEE, SONEB, MTN, Canal+)
- 📱 **Paiement marchand** par QR Code

### Points Forts
- ✅ **Frais quasi nuls**: 0.8% contre 7-15% chez les concurrents
- ⚡ **Rapidité**: Moins de 30 minutes de bout en bout  
- 🔒 **Sécurité**: Chiffrement AES-256 + blockchain Polygon
- 📱 **PWA**: Installation possible sur mobile, fonctionnent hors ligne

## 🛠️ Tech Stack

### Frontend
- HTML5 / CSS3 / JavaScript Vanilla
- Lucide Icons
- Design responsive (mobile-first)
- **PWA** avec Service Worker

### Backend
- Node.js + Express.js
- Prisma ORM (SQLite dev, PostgreSQL prod)
- JSON Web Tokens (JWT)
- Twilio (SMS OTP)

### Blockchain
- Solidity (Smart Contracts)
- Polygon Amoy Testnet
- Hardhat (dev, test, deploy)
- ethers.js

## 📂 Structure du Projet

```
LumniX/
├── index.html              # Page d'accueil principale
├── app.html             # Prototype interactif
├── app-styles.css       # Styles CSS
├── app-script.js        # Logique JavaScript
├── manifest.json        # Manifeste PWA
├── sw.js              # Service Worker PWA
├── README.md          # Ce fichier
│
├── backend/            # Serveur Node.js
│   ├── src/
│   │   ├── index.js          # Point d'entrée
│   │   ├── prismaClient.js   # Client Prisma
│   │   ├── middleware/
│   │   │   └── auth.js       # Auth JWT
│   │   ├── routes/
│   │   │   ├── auth.js       # Inscription/OTP
│   │   │   ├── transfer.js   # Transferts
│   │   │   ├── withdraw.js   # Retraits
│   │   │   ├── rates.js     # Taux change
│   │   │   └── transactions.js # Historique
│   │   └── services/
│   │       ├── blockchain.js # Interactions Polygon
│   │       ├── coingecko.js  # API taux
│   │       └── twilio.js     # SMS OTP
│   └── prisma/
│       └── schema.prisma     # Schema BDD
│
├── contracts/          # Smart Contracts
│   ├── contracts/
│   │   ├── DiasporaTransfer.sol  # Contrat principal
│   │   └── MockUSDC.sol        # Stablecoin test
│   ├── scripts/
│   │   ├── deploy.js         # Déploiement
│   │   ├── faucet.js        # Faucet testnet
│   │   ├── fund-alice-local.js
│   │   └── fund-alice.js
│   └── test/
│       └── DiasporaTransfer.test.js
│
└── assets/
    └── favicon.svg     # Icône
```

## 🚦 Pour Commencer

### Prérequis
- Node.js v22+
- npm ou yarn

### Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/Souraka229/LumniX.git
cd LumniX

# 2. Installer les dépendances backend
cd backend
npm install
npx prisma db push
npx prisma generate

# 3. Lancer le backend
npm start
# Serveur sur http://localhost:3000
```

### Lancer le Frontend

```bash
# Depuis la racine
npx serve .
# ou simplement ouvrir index.html dans le navigateur
```

### Blockchain Locale (Optionnel)

```bash
cd contracts
npm install
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

## 📝 Variables d'Environnement

Créez un fichier `.env` dans `backend/`:

```env
DATABASE_URL="file:./dev.db"
ENCRYPTION_KEY="votre_cle_hex_64_caracteres"
JWT_SECRET="votre_secret_jwt"
RELAYER_PRIVATE_KEY="cle_privee_wallet_relayer"
AMOY_RPC_URL="https://rpc-amoy.polygon.technology"
USE_REAL_TWILIO="false"
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""
```

## 🔌 API Endpoints

| Méthode | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Inscription/Connexion OTP |
| POST | `/api/auth/verify-otp` | Vérification OTP & JWT |
| POST | `/api/transfer` | Initier un transfert |
| POST | `/api/withdraw` | Retirer des fonds |
| GET | `/api/rates` | Taux de change |
| GET | `/api/transactions` | Historique transferts |

Voir `API_FRONTEND_DOCS.md` pour la documentation complète.

## 🎯 Objectifs de Développement Durable

DiasporaConnect contribue aux :

- **ODD 1** - Fin de la pauvreté : Réduire les frais de transfert
- **ODD 8** - Travail décent : Faciliter les investissements diaspora
- **ODD 10** - Inégalités réduites : Frais 0.8% vs 3% objectif 2030

## 🚀 Déploiement

### Frontend (Vercel)

1. Connectez-vous à [vercel.com](https://vercel.com) avec GitHub
2. Importez le repo `MIABE-HACK-2026`
3. Le fichier `vercel.json` est déjà configuré
4. Déployez !

### Backend (Render)

1. Connectez-vous à [render.com](https://render.com) avec GitHub
2. Cliquez **New** > **Blueprint** et sélectionnez le repo
3. Le fichier `render.yaml` configurera automatiquement :
   - Un serveur web Node.js (backend)
   - Une base de données PostgreSQL
4. Ajoutez les variables d'environnement manquantes si nécessaire (voir `backend/.env.example`)

### Base de données PostgreSQL

La base de données est configurée automatiquement via Render Blueprint. Pour une configuration manuelle :

```bash
cd backend
cp .env.example .env
# Editez .env avec votre DATABASE_URL PostgreSQL
npm install
npx prisma db push
npm start
```

## 👥 Équipe

Projet développé pour le **MIABE Hackathon 2026** - Béninin.

## 📜 Licence

MIT License

## 🔗 Liens

- **Documentation API**: Voir `API_FRONTEND_DOCS.md`
- **Doc Technique Blockchain**: Voir `DiasporaConnect_Technique_Blockchain.docx`

---

<p align="center">Fait avec ❤️ pour la diaspora africaine</p>
