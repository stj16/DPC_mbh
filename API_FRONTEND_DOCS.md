# 📄 Contrats API et Schémas - Backend DiasporaConnect

Ce document liste l'ensemble des schémas de données et des routes d'API exposées par le backend pour l'intégration avec le Frontend.

---

## 1. Modèles de Base de données

*Note : Certains champs sensibles (comme la clé privée chiffrée ou les codes OTP) ne sont jamais retournés par l'API pour des raisons de sécurité.*

### Objet `User` (Utilisateur)
- `id` (String) : Identifiant unique (UUID).
- `phone` (String) : Numéro de téléphone (Unique, sert d'identifiant de connexion, ex: "+33600000000").
- `name` (String) : Nom complet de l'utilisateur.
- `walletAddress` (String) : Adresse publique du wallet Ethereum/Polygon (ex: "0x123...").
- `isVerified` (Boolean) : Indique si le compte a été validé via SMS (OTP).
- `createdAt` (DateTime) : Date de création du compte.

### Objet `Transfer` (Transaction)
- `id` (String) : Identifiant unique interne.
- `transferId` (String) : Référence publique du transfert générée par le système (ex: `TXN-2026-ABCD1234`).
- `senderId` (String) : ID du User qui a envoyé les fonds.
- `recipientPhone` (String) : Numéro de téléphone de la personne qui doit recevoir les fonds.
- `amountEur` (Float) : Montant de départ en Euros.
- `amountUsdc` (Float) : Montant converti et stocké sur la blockchain.
- `feeUsdc` (Float) : Frais de la plateforme prélevés (~0.1%).
- `txHash` (String | null) : Hash de la transaction blockchain sur le réseau Polygon.
- `status` (String) : État du transfert (`INITIATED`, `LOCKED`, `RELEASED`, `CANCELLED`).
- `createdAt` (DateTime) : Timestamp de l'initiation du transfert.

---

## 2. Endpoints de l'API REST

**Toutes les routes (hors Register/OTP et Rates) nécessitent le token JWT dans les headers :**
```http
Authorization: Bearer <TOKEN>
```

### 🔑 A. Authentification & Inscription (Flux "Passwordless")

> **💡 Note pour le Frontend (Logique Sans Mot de Passe) :**
> Le système est conçu pour être "Passwordless" (comme WhatsApp ou Telegram).
> **L'inscription et la connexion utilisent exactement le même flux réseau.**
> - Si le numéro est inconnu, le backend crée le compte et son wallet Ethereum en arrière-plan.
> - Si le numéro existe déjà, le backend sait que c'est une connexion et génère simplement un nouveau code SMS.
> 
> *Conséquence UI :* Il n'y a pas besoin de créer des écrans séparés "Se connecter" ou "Créer un compte". Il suffit d'un écran "Entrez votre numéro de téléphone", suivi de l'écran "Entrez le code reçu par SMS".

#### 1. Inscription / Connexion (Génère le SMS OTP)
- **Route :** `POST /api/auth/register`
- **Body attendu :**
  ```json
  {
    "phone": "+33600000000",
    "name": "Alice Dupont"
  }
  ```
- **Réponse (200 OK) :**
  ```json
  {
    "message": "OTP envoyé",
    "phone": "+33600000000"
  }
  ```

#### 2. Vérification OTP (Authentification et obtention du Token JWT)
- **Route :** `POST /api/auth/verify-otp`
- **Body attendu :**
  ```json
  {
    "phone": "+33600000000",
    "otpCode": "123456"
  }
  ```
- **Réponse (200 OK) :**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR...", 
    "user": {
      "id": "abc-123-def",
      "name": "Alice Dupont",
      "phone": "+33600000000",
      "walletAddress": "0x4E426F2174EA685EA..."
    }
  }
  ```

---

### 💸 B. Transferts & Mobile Money

#### 3. Initier un transfert
- **Route :** `POST /api/transfer`
- **Headers :** `Authorization: Bearer <TOKEN>`
- **Body attendu :**
  ```json
  {
    "amountEur": 50,
    "recipientPhone": "+22966111111"
  }
  ```
- **Réponse (200 OK) :**
  ```json
  {
    "message": "Transfert initié et bloqué sur la blockchain",
    "transferId": "TXN-2026-ABCD1234",
    "txHash": "0xabc123hash...",
    "amountUsdc": 54.0,
    "status": "LOCKED"
  }
  ```

#### 4. Retirer l'argent en Fiat / Mobile Money (Côté destinataire)
- **Route :** `POST /api/withdraw`
- **Headers :** `Authorization: Bearer <TOKEN>`
- **Body attendu :**
  ```json
  {
    "transferId": "TXN-2026-ABCD1234"
  }
  ```
- **Réponse (200 OK) :**
  ```json
  {
    "message": "Fonds retirés avec succès (Simulation Mobile Money)",
    "amountXof": 32670,
    "txHash": "0xdef456hash..."
  }
  ```

---

### 📊 C. Informations & Données du Dashboard

#### 5. Obtenir les taux de change (Temps réel)
- **Route :** `GET /api/rates`
- **Body attendu :** `Aucun`
- **Réponse (200 OK) :**
  ```json
  {
    "eurToUsdc": 1.08,
    "usdcToXof": 605.00,
    "eurToXof": 655.95,
    "updatedAt": "2026-05-02T10:49:39.543Z"
  }
  ```

#### 6. Obtenir l'historique des transferts (Envoyés & Reçus)
- **Route :** `GET /api/transactions`
- **Headers :** `Authorization: Bearer <TOKEN>`
- **Body attendu :** `Aucun`
- **Réponse (200 OK) :** Un tableau avec toutes les transactions liées à l'utilisateur connecté.
  ```json
  [
    {
      "id": "uuid-1234",
      "transferId": "TXN-2026-ABCD1234",
      "senderId": "uuid-alice",
      "recipientPhone": "+22966111111",
      "amountEur": 50.0,
      "amountUsdc": 54.0,
      "feeUsdc": 0.054,
      "status": "LOCKED",
      "txHash": "0xabc123hash...",
      "createdAt": "2026-05-02T10:50:00.000Z",
      "sender": {
        "name": "Alice Dupont",
        "phone": "+33600000000"
      }
    }
  ]
  ```

---

## 3. Gestion des Erreurs (Pour le Frontend)

Si une requête échoue (OTP invalide, solde insuffisant, numéro inconnu, etc.), le backend ne crashera pas l'application front. Il renverra un code HTTP d'erreur (400 ou 404) avec ce format JSON constant :

```json
{
  "error": "Le message explicatif (ex: Code OTP incorrect)"
}
```

> *💡 Conseil UI : Dans les requêtes (Fetch ou Axios), ajoutez un bloc `try/catch` et captez toujours ce champ `error` pour l'afficher directement dans une petite notification rouge (un "toast") à l'utilisateur.*
