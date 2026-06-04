// LaunchEdge CoPilot — JS
// Prompt card interaction, input bar, mascot parallax

// Typing placeholder animation
const inputEl = document.querySelector('.copilot-input-bar input');
if (inputEl) {
  const prompts = [
    'Ask CoPilot anything...',
    'How should I price my product?',
    'Help me write a business plan...',
    'What are my growth opportunities?',
    'Summarize today\'s priorities...'
  ];
  let pi = 0;

  function cyclePlaceholder() {
    pi = (pi + 1) % prompts.length;
    inputEl.setAttribute('placeholder', prompts[pi]);
  }

  setInterval(cyclePlaceholder, 3200);
}

// Prompt card hover glow
document.querySelectorAll('.prompt-card').forEach(card => {
  card.addEventListener('mouseenter', () => {
    card.style.boxShadow = '0 8px 32px rgba(196,150,58,0.18)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.boxShadow = '';
  });
});

// Mascot parallax (subtle)
if (window.initParallax) {
  initParallax('.copilot-mascot', 5);
}
