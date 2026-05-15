/* ============================================================
   DiasporaConnect — Landing Page Script
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();

  // === NAVBAR SCROLL ===
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });

  // === MOBILE MENU ===
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');
  const navActions = document.getElementById('navActions');

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      navActions.classList.toggle('open');
    });
  }

  // Close mobile menu on link click
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navActions.classList.remove('open');
    });
  });

  // === CALCULATOR ===
  const defaultRates = { USD: 592, EUR: 655.957, GBP: 746, CAD: 435 };
  const flagMap = { USD: 'us', EUR: 'eu', GBP: 'gb', CAD: 'ca' };

  const sendAmount = document.getElementById('sendAmount');
  const sendCurrency = document.getElementById('sendCurrency');
  const sendFlag = document.getElementById('sendFlag');
  const receiveAmount = document.getElementById('receiveAmount');
  const ourFee = document.getElementById('ourFee');

  function fmt(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function updateCalc() {
    if (!sendAmount || !sendCurrency) return;
    const amount = parseFloat(sendAmount.value) || 0;
    const cur = sendCurrency.value;
    const rate = defaultRates[cur] || 592;
    const fee = amount * 0.008;
    const received = amount * rate * 0.992;

    if (receiveAmount) receiveAmount.textContent = fmt(received);
    if (ourFee) ourFee.textContent = fee.toFixed(2).replace('.', ',') + ' ' + cur;
    if (sendFlag) sendFlag.src = `https://flagcdn.com/w40/${flagMap[cur] || 'us'}.png`;
  }

  if (sendAmount) sendAmount.addEventListener('input', updateCalc);
  if (sendCurrency) sendCurrency.addEventListener('change', updateCalc);
  updateCalc();

  // === FAQ ACCORDION ===
  document.querySelectorAll('.faq-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });

  // === SCROLL ANIMATIONS ===
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    document.querySelectorAll('[data-animate="fade-up"]').forEach(el => {
      gsap.from(el, {
        y: 40, opacity: 0, duration: 0.8,
        delay: parseFloat(el.dataset.delay || 0),
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
      });
    });

    document.querySelectorAll('[data-animate="fade-left"]').forEach(el => {
      gsap.from(el, {
        x: 60, opacity: 0, duration: 0.8,
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
      });
    });

    document.querySelectorAll('[data-animate="scale-up"]').forEach(el => {
      gsap.from(el, {
        scale: 0.9, opacity: 0, duration: 0.8,
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
      });
    });
  }
});
