#!/bin/bash

echo "🛑 Nettoyage..."
killall node || true
rm -f backend/dev.db

echo "🌍 Démarrage Hardhat Node..."
cd contracts
source ~/.nvm/nvm.sh && nvm use 22
npx hardhat node > ../node.log 2>&1 &
NODE_PID=$!
sleep 3

echo "🚀 Déploiement des smart contracts..."
npx hardhat run scripts/deploy.js --network localhost > /dev/null

echo "🛠 Démarrage Backend..."
cd ../backend
npx prisma db push > /dev/null
npm start > ../backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

echo "👤 Inscription Alice..."
curl -s -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"phone": "+33600000000", "name": "Alice"}' > /dev/null
ALICE_DATA=$(curl -s -X POST http://localhost:3000/api/auth/verify-otp -H "Content-Type: application/json" -d '{"phone": "+33600000000", "otpCode": "123456"}')
ALICE_TOKEN=$(echo $ALICE_DATA | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
ALICE_WALLET=$(echo $ALICE_DATA | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['walletAddress'])")
echo $ALICE_WALLET > alice_wallet.txt

echo "👤 Inscription Bob..."
curl -s -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"phone": "+22966111111", "name": "Bob"}' > /dev/null
BOB_DATA=$(curl -s -X POST http://localhost:3000/api/auth/verify-otp -H "Content-Type: application/json" -d '{"phone": "+22966111111", "otpCode": "123456"}')
BOB_TOKEN=$(echo $BOB_DATA | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo "💰 Financement Blockchain Alice..."
cd ../contracts
npx hardhat run scripts/fund-alice-local.js --network localhost > /dev/null

echo "📨 Transfert Alice -> Bob (50 EUR)..."
cd ../backend
curl -s -X POST http://localhost:3000/api/transfer -H "Content-Type: application/json" -H "Authorization: Bearer $ALICE_TOKEN" -d '{"amountEur": 50, "recipientPhone": "+22966111111"}' > transfer_res.json
cat transfer_res.json
TRANSFER_ID=$(cat transfer_res.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('transferId', ''))")

echo -e "\n\n💸 Retrait Mobile Money (Bob)..."
curl -s -X POST http://localhost:3000/api/withdraw -H "Content-Type: application/json" -H "Authorization: Bearer $BOB_TOKEN" -d '{"transferId": "'$TRANSFER_ID'"}'

echo -e "\n\n🛑 Fin test E2E"
kill $NODE_PID || true
kill $BACKEND_PID || true
