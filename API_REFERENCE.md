# 🤖 API Reference - DiasporaConnect Backend

## Base URL
```
Production: https://diasporaconnect-api.vercel.app/api
Local:    http://localhost:3000/api
```

## Authentication

### Register (Inscription)
```http
POST /auth/register
Content-Type: application/json

{
  "name": "Kofi Mensah",
  "phone": "+33781234567",
  "pin": "1234"
}
```
**Response:**
```json
{
  "message": "OTP envoyé",
  "phone": "+33781234567"
}
```

### Verify OTP
```http
POST /auth/verify-otp
Content-Type: application/json

{
  "phone": "+33781234567",
  "otpCode": "123456"
}
```
**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "name": "Kofi Mensah",
    "phone": "+33781234567",
    "walletAddress": "0x6C66e410CED4f0D3A..."
  }
}
```

## Transfer

### Create Transfer
```http
POST /transfer
Authorization: Bearer <token>
Content-Type: application/json

{
  "amountEur": 100,
  "recipientPhone": "+22966123456"
}
```
**Response:**
```json
{
  "transferId": "TXN-2026-ABC123",
  "txHash": "0x719f963e160f8a9028f...",
  "amountUsdc": 108,
  "amountXof": 65596,
  "feeUsdc": 0.864,
  "status": "LOCKED",
  "simulation": false
}
```

## Errors

| Code | Message |
|------|---------|
| 400  | Invalid request |
| 401  | Unauthorized |
| 404  | Not found |
| 500  | Server error |

## Rate Limits
- 100 requests/minute per IP
- 1000 requests/day per user