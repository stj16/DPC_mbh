/* ============================================================
   DiasporaConnect — Functional Prototype Logic
   Backend API integration with realistic mock fallbacks
   ============================================================ */

// Auto-detect API base URL:
// - In production, set window.DIASPORA_API_URL or use environment-specific URL
// - Falls back to localhost for development, or '' for pure mock mode
const API_BASE = window.DIASPORA_API_URL || (
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : '' // Mock mode for static hosting without backend
);

// ===================== EXCHANGE RATES =====================
const defaultRates = { USD: 592, EUR: 655.957, GBP: 746, CAD: 435 };
const flagMap = { USD: 'us', EUR: 'eu', GBP: 'gb', CAD: 'ca' };
let currentRates = { ...defaultRates };

// ===================== STATE =====================
let transferState = {
  senderName: '',
  senderPhone: '',
  recipientPhone: '',
  amount: 0,
  currency: 'EUR',
  amountXof: 0,
  fee: 0,
  token: null,
  transferId: null,
  txHash: null
};

let beninState = {
  foundTransfer: null,
  selectedTransferId: null,
  withdrawAmount: 0
};

// In-memory transfer store for demo (simulates DB)
let demoTransfers = [];

// ===================== UTILS =====================
function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast toast-show toast-' + (type || 'info');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast'; }, 3500);
}

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Chargement...';
    btn.disabled = true;
    btn.style.opacity = '0.7';
  } else {
    btn.innerHTML = btn.dataset.origText || btn.innerHTML;
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

function generateTxId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'TXN-2026-';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generateRef() {
  return 'REF-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

// ===================== API CALLS WITH MOCK FALLBACK =====================

async function apiSendOTP(phone, name) {
  try {
    if (!API_BASE) throw new Error('No API');
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
    return await res.json();
  } catch {
    await delay(1200);
    return { success: true, message: 'OTP envoye (simulation)', phone };
  }
}

async function apiVerifyOTP(phone, otpCode) {
  try {
    if (!API_BASE) throw new Error('No API');
    const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otpCode })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Code OTP incorrect');
    }
    return await res.json();
  } catch (e) {
    if (e.message === 'Code OTP incorrect') throw e;
    await delay(1000);
    if (otpCode !== '123456') {
      throw new Error('Code OTP incorrect');
    }
    return {
      success: true,
      token: 'mock-jwt-' + Date.now(),
      user: {
        id: 'user-' + Date.now(),
        name: transferState.senderName,
        phone: phone,
        walletAddress: '0x' + Array(40).fill(0).map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
      }
    };
  }
}

async function apiSendTransfer(token, amountEur, recipientPhone) {
  try {
    if (!API_BASE) throw new Error('No API');
    const res = await fetch(`${API_BASE}/api/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amountEur, recipientPhone })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
    return await res.json();
  } catch {
    await delay(1500);
    const txId = generateTxId();
    const rate = currentRates[transferState.currency] || 655.957;
    const amountXof = Math.round(transferState.amount * rate * 0.992);

    // Store in demo DB
    const transfer = {
      transferId: txId,
      senderName: transferState.senderName,
      senderPhone: transferState.senderPhone,
      recipientPhone: recipientPhone,
      amount: transferState.amount,
      currency: transferState.currency,
      amountXof: amountXof,
      fee: transferState.amount * 0.008,
      status: 'LOCKED',
      txHash: '0x' + Array(64).fill(0).map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''),
      createdAt: new Date().toISOString()
    };
    demoTransfers.push(transfer);

    return {
      success: true,
      message: 'Transfert initie et bloque sur la blockchain (simulation)',
      transferId: txId,
      txHash: transfer.txHash,
      amountUsdc: (transferState.amount * 1.08).toFixed(2),
      amountXof: amountXof,
      status: 'LOCKED'
    };
  }
}

async function apiSearchTransfer(phone, txId) {
  try {
    if (!API_BASE) throw new Error('No API');
    const endpoint = txId
      ? `${API_BASE}/api/transfer/${txId}`
      : `${API_BASE}/api/transfer/${phone}`;
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('Not found');
    return await res.json();
  } catch {
    await delay(1000);

    // Search in demo transfers
    let found = null;
    if (txId) {
      found = demoTransfers.find(t => t.transferId === txId);
    }
    if (!found && phone) {
      const cleanPhone = phone.replace(/\s/g, '');
      found = demoTransfers.find(t => t.recipientPhone.replace(/\s/g, '') === cleanPhone);
    }

    if (found) return { success: true, transfers: [found] };

    // Fallback demo data
    const fakePhone = phone || '+229 97 00 00 00';
    return {
      success: true,
      transfers: [
        {
          transferId: 'TXN-2026-DEMO001',
          senderName: 'Aminata Diallo',
          senderPhone: '+33 6 12 34 56 78',
          recipientPhone: fakePhone,
          amount: 200,
          currency: 'USD',
          amountXof: 118400,
          fee: 1.60,
          status: 'LOCKED',
          txHash: '0xabc123...demo',
          createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          transferId: 'TXN-2026-DEMO002',
          senderName: 'Kofi Mensah',
          senderPhone: '+33 7 98 76 54 32',
          recipientPhone: fakePhone,
          amount: 100,
          currency: 'EUR',
          amountXof: 65596,
          fee: 0.80,
          status: 'LOCKED',
          txHash: '0xdef456...demo',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ]
    };
  }
}

async function apiWithdraw(token, transferId, momoProvider, momoPhone) {
  try {
    if (!API_BASE) throw new Error('No API');
    const res = await fetch(`${API_BASE}/api/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || 'mock'}`
      },
      body: JSON.stringify({ transferId })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
    return await res.json();
  } catch {
    await delay(1800);
    // Update demo transfer
    const t = demoTransfers.find(tx => tx.transferId === transferId);
    if (t) t.status = 'RELEASED';

    return {
      success: true,
      message: 'Fonds retires avec succes (Simulation Mobile Money)',
      amountXof: beninState.withdrawAmount,
      txHash: '0x' + Array(64).fill(0).map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''),
      reference: generateRef(),
      provider: momoProvider,
      phone: momoPhone
    };
  }
}

// ===================== TRANSACTION HISTORY =====================

async function apiGetHistory(token) {
  try {
    if (!API_BASE || !token || token.startsWith('mock-')) throw new Error('No API');
    const res = await fetch(`${API_BASE}/api/transactions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Auth required');
    return await res.json();
  } catch {
    // Mock fallback: return demoTransfers + fake history
    const mockHistory = demoTransfers.length > 0 ? demoTransfers : [
      { transferId: 'TXN-2026-DEMO01', recipientPhone: '+229 91 23 45 67', amount: 100, currency: 'EUR', amountXof: 65596, status: 'LOCKED', createdAt: new Date(Date.now() - 3600000).toISOString() },
      { transferId: 'TXN-2026-DEMO02', recipientPhone: '+229 97 88 77 66', amount: 200, currency: 'USD', amountXof: 118400, status: 'RELEASED', createdAt: new Date(Date.now() - 86400000).toISOString() }
    ];
    return mockHistory;
  }
}

function renderHistory(transactions) {
  const container = document.getElementById('dHistoryTx');
  if (!container) return;

  if (!transactions || transactions.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--g400);font-size:.9rem;">Aucune transaction pour l'instant</div>`;
    return;
  }

  container.innerHTML = transactions.map(t => {
    const isReceived = t.recipientPhone === transferState.senderPhone;
    const label = isReceived ? (t.sender?.name || 'Reçu') : (t.recipientPhone || 'Envoyé');
    const initials = label.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const avatarClass = isReceived ? 'avatar-green-sm' : 'avatar-orange-sm';
    const amountText = isReceived
      ? `+${fmt(t.amountXof || 0)} XOF`
      : `-${t.amount} ${t.currency || 'EUR'}`;
    const amountColor = isReceived ? 'color:var(--green)' : 'color:var(--dark)';
    const statusBadge = t.status === 'RELEASED'
      ? `<span style="font-size:.7rem;background:var(--green-light);color:var(--green);padding:2px 6px;border-radius:99px;font-weight:600;">Retiré</span>`
      : t.status === 'LOCKED'
        ? `<span style="font-size:.7rem;background:#FFF7ED;color:var(--orange);padding:2px 6px;border-radius:99px;font-weight:600;">En cours</span>`
        : '';
    const date = t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';

    return `
      <div class="tx-item">
        <div class="avatar ${avatarClass}">${initials || '??'}</div>
        <div class="tx-info">
          <strong>${label}</strong>
          <span>${date} ${statusBadge}</span>
        </div>
        <span class="tx-amount" style="${amountColor}">${amountText}</span>
      </div>`;
  }).join('');
}

async function apiGetRates() {
  try {
    if (!API_BASE) throw new Error('No API');
    const res = await fetch(`${API_BASE}/api/rates`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.eurToXof) currentRates.EUR = data.eurToXof;
    if (data.usdcToXof) {
      currentRates.USD = data.usdcToXof / 1.08;
    }
    return data;
  } catch {
    return { eurToUsdc: 1.08, usdcToXof: 605, eurToXof: 655.957 };
  }
}

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  setupOTPInputs();
  updateCalc();
  updateTransferCalc();
  apiGetRates();

  // ===================== PORTAL NAVIGATION =====================
  const portalSelector = document.getElementById('portalSelector');
  const diasporaApp = document.getElementById('diasporaApp');
  const beninApp = document.getElementById('beninApp');

  window.openPortal = function (portal) {
    portalSelector.classList.remove('active-view');
    diasporaApp.classList.remove('active-view');
    beninApp.classList.remove('active-view');

    if (portal === 'diaspora') {
      diasporaApp.classList.add('active-view');
    } else {
      beninApp.classList.add('active-view');
    }
    if (window.lucide) lucide.createIcons();
  };

  window.showPortalSelector = function () {
    diasporaApp.classList.remove('active-view');
    beninApp.classList.remove('active-view');
    portalSelector.classList.add('active-view');
  };

  // ===================== SCREEN NAVIGATION =====================
  window.goScreen = function (screenId) {
    const appShell = document.getElementById(screenId).closest('.app-shell');
    const screens = appShell.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));

    const target = document.getElementById(screenId);
    target.classList.add('active');

    const nav = appShell.querySelector('.bottom-nav');
    const navItems = nav.querySelectorAll('.bnav-item');

    const dMap = { 'd-home': 0, 'd-transfer': 1, 'd-otp': 1, 'd-summary': 1, 'd-sent': 1, 'd-history': 2, 'd-profile': 3 };
    const bMap = { 'b-home': 0, 'b-receive': 1, 'b-bills': 2, 'b-withdraw': 3, 'b-profile': -1 };
    const map = screenId.startsWith('d-') ? dMap : bMap;
    const activeIdx = map[screenId] ?? -1;

    navItems.forEach((item, i) => {
      item.classList.toggle('active', i === activeIdx);
    });

    if (window.lucide) lucide.createIcons();

    // Load real history when navigating to d-history
    if (screenId === 'd-history') {
      const container = document.getElementById('dHistoryTx');
      if (container) container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--g400);font-size:.9rem;"><span class="spinner"></span> Chargement...</div>';
      apiGetHistory(transferState.token).then(txs => renderHistory(txs));
    }
  };

  // ===================== HOME CALCULATOR =====================
  const dSendAmt = document.getElementById('dSendAmt');
  const dSendCur = document.getElementById('dSendCur');

  if (dSendAmt) dSendAmt.addEventListener('input', updateCalc);
  if (dSendCur) dSendCur.addEventListener('change', updateCalc);

  // ===================== TRANSFER FORM CALC =====================
  const tfAmount = document.getElementById('tfAmount');
  const tfCurrency = document.getElementById('tfCurrency');

  if (tfAmount) tfAmount.addEventListener('input', updateTransferCalc);
  if (tfCurrency) tfCurrency.addEventListener('change', updateTransferCalc);
});

// ===================== CALCULATOR FUNCTIONS =====================
function updateCalc() {
  const dSendAmt = document.getElementById('dSendAmt');
  const dSendCur = document.getElementById('dSendCur');
  const dSendFlag = document.getElementById('dSendFlag');
  const dRecvAmt = document.getElementById('dRecvAmt');
  const dFee = document.getElementById('dFee');

  const amount = parseFloat(dSendAmt.value) || 0;
  const cur = dSendCur.value;
  const rate = currentRates[cur] || 592;
  const fee = amount * 0.008;
  const received = amount * rate * 0.992;

  dRecvAmt.textContent = fmt(received);
  dFee.textContent = fee.toFixed(2).replace('.', ',') + ' ' + cur;

  const code = flagMap[cur] || 'us';
  dSendFlag.src = `https://flagcdn.com/w40/${code}.png`;
}

function updateTransferCalc() {
  const tfAmount = document.getElementById('tfAmount');
  const tfCurrency = document.getElementById('tfCurrency');
  const tfRecv = document.getElementById('tfRecv');
  const tfRateDisplay = document.getElementById('tfRateDisplay');
  const tfFeeDisplay = document.getElementById('tfFeeDisplay');
  const tfCurFlag = document.getElementById('tfCurFlag');

  if (!tfAmount || !tfCurrency) return;

  const amount = parseFloat(tfAmount.value) || 0;
  const cur = tfCurrency.value;
  const rate = currentRates[cur] || 655.957;
  const fee = amount * 0.008;
  const received = amount * rate * 0.992;

  if (tfRecv) tfRecv.textContent = fmt(received);
  if (tfRateDisplay) tfRateDisplay.textContent = `1 ${cur} = ${rate.toLocaleString('fr-FR')} XOF`;
  if (tfFeeDisplay) tfFeeDisplay.textContent = fee.toFixed(2).replace('.', ',') + ' ' + cur;

  const code = flagMap[cur] || 'eu';
  if (tfCurFlag) tfCurFlag.src = `https://flagcdn.com/w40/${code}.png`;
}

// ===================== OTP INPUT HANDLING =====================
function setupOTPInputs() {
  const digits = document.querySelectorAll('.otp-digit');
  digits.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = val;
      if (val && idx < digits.length - 1) {
        digits[idx + 1].focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        digits[idx - 1].focus();
      }
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
      for (let i = 0; i < Math.min(paste.length, 6); i++) {
        digits[i].value = paste[i];
      }
      if (paste.length >= 6) digits[5].focus();
    });
  });
}

function getOTPCode() {
  return Array.from(document.querySelectorAll('.otp-digit')).map(d => d.value).join('');
}

function clearOTPInputs() {
  document.querySelectorAll('.otp-digit').forEach(d => { d.value = ''; });
}

// ===================== DIASPORA TRANSFER FLOW =====================

window.startTransferFlow = async function () {
  const senderName = document.getElementById('tfSenderName').value.trim();
  const senderPhone = document.getElementById('tfSenderPhone').value.trim();
  const recipientPhone = document.getElementById('tfRecipientPhone').value.trim();
  const amount = parseFloat(document.getElementById('tfAmount').value) || 0;
  const currency = document.getElementById('tfCurrency').value;

  // Validation
  if (!senderName) { showToast('Veuillez entrer votre nom complet', 'error'); return; }
  if (!senderPhone) { showToast('Veuillez entrer votre numero de telephone', 'error'); return; }
  if (!recipientPhone) { showToast('Veuillez entrer le numero du destinataire', 'error'); return; }
  if (amount <= 0) { showToast('Le montant doit etre superieur a 0', 'error'); return; }

  // Save state
  transferState.senderName = senderName;
  transferState.senderPhone = senderPhone;
  transferState.recipientPhone = recipientPhone;
  transferState.amount = amount;
  transferState.currency = currency;

  const rate = currentRates[currency] || 655.957;
  transferState.fee = amount * 0.008;
  transferState.amountXof = Math.round(amount * rate * 0.992);

  // Send OTP
  const btn = document.querySelector('#d-transfer .btn-primary-full');
  setLoading(btn, true);

  try {
    const result = await apiSendOTP(senderPhone, senderName);
    showToast(result.message || 'Code OTP envoye !', 'success');

    // Show OTP screen
    document.getElementById('otpPhoneDisplay').textContent = senderPhone;
    clearOTPInputs();
    goScreen('d-otp');

    // Focus first OTP input
    setTimeout(() => {
      document.querySelector('.otp-digit[data-idx="0"]').focus();
    }, 400);
  } catch (e) {
    showToast(e.message || 'Erreur lors de l\'envoi du code', 'error');
  } finally {
    setLoading(btn, false);
  }
};

window.verifyOTP = async function () {
  const code = getOTPCode();
  if (code.length !== 6) {
    showToast('Veuillez entrer le code complet a 6 chiffres', 'error');
    return;
  }

  const btn = document.getElementById('btnVerifyOtp');
  setLoading(btn, true);

  try {
    const result = await apiVerifyOTP(transferState.senderPhone, code);
    transferState.token = result.token;

    showToast('Code verifie avec succes !', 'success');

    // Update summary screen
    const rate = currentRates[transferState.currency] || 655.957;
    document.getElementById('sumRateDisplay').textContent = `1 ${transferState.currency} = ${rate.toLocaleString('fr-FR')} XOF`;
    document.getElementById('sumRecvAmount').textContent = fmt(transferState.amountXof);
    document.getElementById('sumSenderName').textContent = transferState.senderName;
    document.getElementById('sumRecipientPhone').textContent = transferState.recipientPhone;
    document.getElementById('sumSentAmount').textContent = `${transferState.amount} ${transferState.currency}`;
    document.getElementById('sumFeeAmount').textContent = transferState.fee.toFixed(2).replace('.', ',') + ' ' + transferState.currency;
    document.getElementById('sumTotalAmount').textContent = (transferState.amount + transferState.fee).toFixed(2).replace('.', ',') + ' ' + transferState.currency;

    goScreen('d-summary');
  } catch (e) {
    showToast(e.message || 'Code OTP incorrect', 'error');
    clearOTPInputs();
    document.querySelector('.otp-digit[data-idx="0"]').focus();
  } finally {
    setLoading(btn, false);
  }
};

window.resendOTP = async function () {
  showToast('Renvoi du code...', 'info');
  await apiSendOTP(transferState.senderPhone, transferState.senderName);
  showToast('Nouveau code OTP envoye !', 'success');
};

window.confirmTransfer = async function () {
  const btn = document.getElementById('btnConfirmTransfer');
  setLoading(btn, true);

  try {
    const result = await apiSendTransfer(
      transferState.token,
      transferState.amount,
      transferState.recipientPhone
    );

    transferState.transferId = result.transferId;
    transferState.txHash = result.txHash;

    // Update sent screen
    document.getElementById('sentAmountXof').innerHTML = fmt(transferState.amountXof) + ' <span class="sent-cur">XOF</span>';
    document.getElementById('sentAmountOrig').textContent = `(${transferState.amount} ${transferState.currency})`;
    document.getElementById('sentFrom').textContent = transferState.senderName;
    document.getElementById('sentTo').textContent = transferState.recipientPhone;
    document.getElementById('sentFees').textContent = transferState.fee.toFixed(2).replace('.', ',') + ' ' + transferState.currency + ' (0.8%)';
    document.getElementById('sentStatus').textContent = 'En cours de traitement';
    document.getElementById('sentTxId').innerHTML = result.transferId + ' <i data-lucide="copy" class="copy-icon" onclick="copyTxId()"></i>';

    showToast('Transfert envoye avec succes !', 'success');
    goScreen('d-sent');
  } catch (e) {
    showToast(e.message || 'Erreur lors du transfert', 'error');
  } finally {
    setLoading(btn, false);
  }
};

window.copyTxId = function () {
  const txId = transferState.transferId || 'TXN-2026-DEMO';
  navigator.clipboard.writeText(txId).then(() => {
    showToast('ID copie !', 'success');
  }).catch(() => {
    showToast('ID: ' + txId, 'info');
  });
};

window.resetDiaspora = function () {
  transferState = {
    senderName: '',
    senderPhone: '',
    recipientPhone: '',
    amount: 0,
    currency: 'EUR',
    amountXof: 0,
    fee: 0,
    token: null,
    transferId: null,
    txHash: null
  };
  document.getElementById('tfSenderName').value = '';
  document.getElementById('tfSenderPhone').value = '';
  document.getElementById('tfRecipientPhone').value = '';
  document.getElementById('tfAmount').value = '100';
  clearOTPInputs();
  goScreen('d-home');
};

// ===================== BENIN PORTAL: SEARCH TRANSFER =====================

window.searchTransfer = async function () {
  const phone = document.getElementById('bSearchPhone').value.trim();
  const txId = document.getElementById('bSearchTxId').value.trim();

  if (!phone && !txId) {
    showToast('Entrez un numero de telephone ou un ID de transaction', 'error');
    return;
  }

  const btn = document.getElementById('btnSearchTransfer');
  setLoading(btn, true);

  try {
    const result = await apiSearchTransfer(phone, txId);
    const resultsDiv = document.getElementById('bSearchResults');
    resultsDiv.style.display = 'block';

    if (!result.transfers || result.transfers.length === 0) {
      resultsDiv.innerHTML = `
        <div class="card" style="padding:20px;text-align:center;">
          <p style="color:var(--g500);font-size:.9rem;">Aucun transfert trouve.</p>
        </div>`;
      return;
    }

    resultsDiv.innerHTML = '<h4 style="font-size:.88rem;font-weight:700;color:var(--dark);margin-bottom:12px;">Transferts trouves</h4>' +
      result.transfers.map(t => {
        const statusColor = t.status === 'LOCKED' ? 'var(--orange)' : t.status === 'RELEASED' ? 'var(--green)' : 'var(--g400)';
        const statusLabel = t.status === 'LOCKED' ? 'En attente' : t.status === 'RELEASED' ? 'Retire' : t.status;
        return `
        <div class="card" style="padding:16px;margin-bottom:8px;">
          <div class="sent-detail"><span>Expediteur</span><strong>${t.senderName || 'Inconnu'}</strong></div>
          <div class="sent-detail"><span>Montant</span><strong class="green-text">${fmt(t.amountXof)} XOF</strong></div>
          <div class="sent-detail"><span>Original</span><strong>${t.amount} ${t.currency}</strong></div>
          <div class="sent-detail"><span>Statut</span><span style="font-weight:600;color:${statusColor}">${statusLabel}</span></div>
          <div class="sent-detail"><span>ID</span><span class="tx-id" style="font-size:.78rem">${t.transferId}</span></div>
          ${t.status === 'LOCKED' ? `<button class="btn-green-full" style="margin-top:12px;padding:12px" onclick="goToWithdrawFromSearch('${t.transferId}', ${t.amountXof})">Retirer en Mobile Money</button>` : ''}
        </div>`;
      }).join('');

    if (window.lucide) lucide.createIcons();
  } catch (e) {
    showToast(e.message || 'Erreur lors de la recherche', 'error');
  } finally {
    setLoading(btn, false);
  }
};

window.goToWithdrawFromSearch = function (txId, amount) {
  beninState.selectedTransferId = txId;
  beninState.withdrawAmount = amount;

  document.getElementById('bWithdrawStep1').style.display = 'none';
  document.getElementById('bWithdrawStep2').style.display = 'block';
  document.getElementById('bWithdrawStep3').style.display = 'none';
  document.getElementById('bWithdrawAmount').textContent = fmt(amount);
  document.getElementById('bWithdrawTxRef').textContent = txId;

  goScreen('b-withdraw');
  if (window.lucide) lucide.createIcons();
};

// ===================== BENIN PORTAL: WITHDRAW =====================

window.searchForWithdraw = async function () {
  const phone = document.getElementById('bWithdrawPhone').value.trim();
  if (!phone) {
    showToast('Entrez votre numero de telephone', 'error');
    return;
  }

  const btn = document.querySelector('#bWithdrawStep1 .btn-green-full');
  setLoading(btn, true);

  try {
    const result = await apiSearchTransfer(phone, null);
    const resultsDiv = document.getElementById('bWithdrawResults');
    resultsDiv.style.display = 'block';

    const locked = (result.transfers || []).filter(t => t.status === 'LOCKED');
    if (locked.length === 0) {
      resultsDiv.innerHTML = `
        <div class="card" style="padding:20px;text-align:center;">
          <p style="color:var(--g500);font-size:.9rem;">Aucun transfert en attente de retrait.</p>
        </div>`;
      return;
    }

    resultsDiv.innerHTML = '<h4 style="font-size:.88rem;font-weight:700;color:var(--dark);margin-bottom:12px;">Transferts disponibles</h4>' +
      locked.map(t => `
        <div class="card" style="padding:16px;margin-bottom:8px;">
          <div class="sent-detail"><span>De</span><strong>${t.senderName || 'Inconnu'}</strong></div>
          <div class="sent-detail"><span>Montant</span><strong class="green-text">${fmt(t.amountXof)} XOF</strong></div>
          <div class="sent-detail"><span>ID</span><span class="tx-id" style="font-size:.78rem">${t.transferId}</span></div>
          <button class="btn-green-full" style="margin-top:12px;padding:12px" onclick="selectTransferForWithdraw('${t.transferId}', ${t.amountXof})">
            Selectionner pour retrait
          </button>
        </div>
      `).join('');

    if (window.lucide) lucide.createIcons();
  } catch (e) {
    showToast(e.message || 'Erreur', 'error');
  } finally {
    setLoading(btn, false);
  }
};

window.selectTransferForWithdraw = function (txId, amount) {
  beninState.selectedTransferId = txId;
  beninState.withdrawAmount = amount;

  document.getElementById('bWithdrawStep1').style.display = 'none';
  document.getElementById('bWithdrawStep2').style.display = 'block';
  document.getElementById('bWithdrawStep3').style.display = 'none';
  document.getElementById('bWithdrawAmount').textContent = fmt(amount);
  document.getElementById('bWithdrawTxRef').textContent = txId;

  if (window.lucide) lucide.createIcons();
};

window.showWithdrawModal = function (provider) {
  const modal = document.getElementById('modalContent');
  const overlay = document.getElementById('modalOverlay');

  modal.innerHTML = `
    <div style="padding:24px;">
      <h3 style="font-size:1.1rem;font-weight:700;color:var(--dark);margin-bottom:4px;">Retrait ${provider}</h3>
      <p style="font-size:.84rem;color:var(--g500);margin-bottom:20px;">Entrez votre numero ${provider} pour recevoir ${fmt(beninState.withdrawAmount)} XOF</p>

      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Numero ${provider}</label>
        <input type="tel" id="modalMomoPhone" class="form-input" placeholder="${provider === 'MTN MoMo' ? '+229 97 00 00 00' : '+229 95 00 00 00'}"/>
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn-outline-full" onclick="closeModal()" style="flex:1">Annuler</button>
        <button class="btn-green-full" id="btnModalWithdraw" onclick="executeWithdraw('${provider}')" style="flex:1">Confirmer</button>
      </div>
    </div>
  `;

  modal.style.display = 'block';
  overlay.style.display = 'block';

  setTimeout(() => {
    document.getElementById('modalMomoPhone').focus();
  }, 300);
  if (window.lucide) lucide.createIcons();
};

window.closeModal = function () {
  document.getElementById('modalContent').style.display = 'none';
  document.getElementById('modalOverlay').style.display = 'none';
};

window.executeWithdraw = async function (provider) {
  const phone = document.getElementById('modalMomoPhone').value.trim();
  if (!phone) {
    showToast('Entrez votre numero Mobile Money', 'error');
    return;
  }

  const btn = document.getElementById('btnModalWithdraw');
  setLoading(btn, true);

  try {
    const result = await apiWithdraw(
      null,
      beninState.selectedTransferId,
      provider,
      phone
    );

    closeModal();

    // Show success
    document.getElementById('bWithdrawStep1').style.display = 'none';
    document.getElementById('bWithdrawStep2').style.display = 'none';
    document.getElementById('bWithdrawStep3').style.display = 'block';

    document.getElementById('wdSuccessAmount').innerHTML = fmt(result.amountXof || beninState.withdrawAmount) + ' <span class="sent-cur">XOF</span>';
    document.getElementById('wdSuccessOperator').textContent = provider;
    document.getElementById('wdSuccessPhone').textContent = phone;
    document.getElementById('wdSuccessRef').textContent = result.reference || generateRef();

    showToast('Retrait effectue avec succes !', 'success');
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    showToast(e.message || 'Erreur lors du retrait', 'error');
  } finally {
    setLoading(btn, false);
  }
};

window.resetBenin = function () {
  beninState = { foundTransfer: null, selectedTransferId: null, withdrawAmount: 0 };
  document.getElementById('bWithdrawStep1').style.display = 'block';
  document.getElementById('bWithdrawStep2').style.display = 'none';
  document.getElementById('bWithdrawStep3').style.display = 'none';
  document.getElementById('bWithdrawResults').style.display = 'none';
  document.getElementById('bSearchResults').style.display = 'none';
  document.getElementById('bSearchPhone').value = '';
  document.getElementById('bSearchTxId').value = '';
  document.getElementById('bWithdrawPhone').value = '';
  goScreen('b-home');
};

// ===================== BILL PAYMENT (DEMO) =====================
window.payBill = async function (name, amount) {
  showToast(`Paiement ${name} en cours...`, 'info');
  await delay(1500);
  showToast(`${name} - ${fmt(amount)} XOF paye avec succes !`, 'success');
};
