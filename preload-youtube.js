// Logging function to visually distinguish our mod's logs
function logInfo(msg) {
  console.log(`[YT Mod Client] ${msg}`);
}

// --- UI LOGIC ---

// --- SEARCH STATE TRACKING ---
function isUserSearching() {
  let el = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) {
    el = el.shadowRoot.activeElement;
  }
  if (!el) return false;

  const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  const isSearchInput = isInput && (
    el.name === 'search_query' ||
    el.id === 'search' ||
    el.getAttribute('placeholder')?.toLowerCase().includes('search') ||
    el.closest?.('ytd-searchbox')
  );

  const isSuggestion = el.classList?.contains('sbqs_c') || el.closest?.('.sbdd_a') || el.closest?.('ytd-search-suggestions-section-renderer');

  return !!(isSearchInput || isSuggestion);
}

window.__isSearching = false;
setInterval(() => {
  window.__isSearching = isUserSearching();
}, 100);

// // --- SHADOW PIERCER ENGINE ---
// Content tags that should never be made transparent or hidden
const CONTENT_TAGS = new Set([
  'IMG', 'VIDEO', 'SVG', 'CANVAS', 'YTD-THUMBNAIL', 'YT-IMAGE',
  'YTD-AVATAR-SHAPE', 'YTD-MOVING-THUMBNAIL-RENDERER', 'YTD-PLAYER',
  'YTD-PLAYLIST-THUMBNAIL', 'YT-FORMATTED-STRING', 'IRON-ICON',
  'YTD-WATCH-METADATA', 'YTD-COMMENTS', 'YTD-MESSAGE-RENDERER'
]);

// --- CUSTOM SEARCH ENGINE ---
function setupCustomSearch() {
  const mastheadEnd = document.querySelector('ytd-masthead #end');
  if (!mastheadEnd || document.getElementById('custom-search-trigger')) return;

  const trigger = document.createElement('div');
  trigger.id = 'custom-search-trigger';
  trigger.title = 'Search (S)';
  trigger.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path>
    </svg>
  `;

  const toggleSearch = (state) => {
    const isActive = state !== undefined ? state : !document.body.classList.contains('search-active');
    document.body.classList.toggle('search-active', isActive);
    if (isActive) {
      const input = document.querySelector('ytd-searchbox input');
      if (input) setTimeout(() => input.focus(), 50);
    }
  };

  trigger.onclick = (e) => {
    e.stopPropagation();
    toggleSearch();
  };

  // Global click-away logic
  document.addEventListener('mousedown', (e) => {
    if (document.body.classList.contains('search-active')) {
      const masthead = document.querySelector('ytd-masthead');
      if (masthead && !masthead.contains(e.target)) {
        toggleSearch(false);
      }
    }
  });

  // ESC key logic
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('search-active')) {
      toggleSearch(false);
    }
  });

  mastheadEnd.prepend(trigger);
  logInfo('Custom search engine active');
}


function recursiveStyleFix(root) {
  if (!root) return;
  
  const elements = root.querySelectorAll ? root.querySelectorAll('*:not([data-fixed])') : [];
  
  elements.forEach(el => {
    const tag = el.tagName || '';
    if (el.shadowRoot) recursiveStyleFix(el.shadowRoot);
    if (CONTENT_TAGS.has(tag)) {
      el.setAttribute('data-fixed', 'true');
      return;
    }
    el.setAttribute('data-fixed', 'true');
  });
}




function runUiPiercer() {
  const path = window.location.pathname;
  if (path !== '/watch' && path !== '/results') {
    document.body.classList.remove('is-watching');
    return;
  }

  document.body.classList.add('is-watching');
  const glow = document.getElementById('ambient-fullscreen-glow');
  if (glow) glow.style.opacity = '0.6';

  // We no longer do recursive transparency here. CSS handles it more safely.
  recursiveStyleFix(document.body);
}

function setupAmbientGlow() {
  let canvas, ctx, glow;

  function initGlow() {
    const video = document.querySelector('video');
    if (!video) return;

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 36;
      ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    }

    if (!glow) {
      glow = document.createElement('div');
      glow.id = 'ambient-fullscreen-glow';
      document.body.prepend(glow);
    }

    function getColor(x, y, w, h) {
      const img = ctx.getImageData(x, y, w, h).data;
      let r = 0, g = 0, b = 0, c = 0;
      for (let i = 0; i < img.length; i += 16) {
        r += img[i]; g += img[i + 1]; b += img[i + 2]; c++;
      }
      return [(r / c) | 0, (g / c) | 0, (b / c) | 0];
    }

    function update() {
      try {
        if (video.paused || video.ended || !document.body.classList.contains('is-watching')) {
          setTimeout(update, 500); return;
        }
        ctx.drawImage(video, 0, 0, 64, 36);
        const left = getColor(0, 0, 16, 36);
        const right = getColor(48, 0, 16, 36);
        const top = getColor(0, 0, 64, 8);
        const bottom = getColor(0, 28, 64, 8);
        glow.style.background = `
          radial-gradient(circle at 15% 50%, rgba(${left[0]},${left[1]},${left[2]},0.8), transparent 70%),
          radial-gradient(circle at 85% 50%, rgba(${right[0]},${right[1]},${right[2]},0.8), transparent 70%),
          radial-gradient(circle at 50% 10%, rgba(${top[0]},${top[1]},${top[2]},0.7), transparent 70%),
          radial-gradient(circle at 50% 90%, rgba(${bottom[0]},${bottom[1]},${bottom[2]},0.7), transparent 70%)
        `;
      } catch (e) { }
      setTimeout(update, 150);
    }
    update();
  }

  const style = document.createElement('style');
  style.textContent = `
    html, body {
        --yt-searchbox-background: transparent !important;
        --ytd-searchbox-background: transparent !important;
        --yt-searchbox-text-color: #fff !important;
    }
    
    /* Transparent Layout */
    body.is-watching ytd-app, 
    body.is-watching #content,
    body.is-watching #page-manager, 
    body.is-watching ytd-watch-flexy,
    body.is-watching #columns, 
    body.is-watching #primary,
    body.is-watching #secondary, 
    body.is-watching #secondary-inner,
    body.is-watching #related, 
    body.is-watching ytd-playlist-panel-renderer,
    body.is-watching #container.ytd-playlist-panel-renderer, 
    body.is-watching #playlist,
    body.is-watching #items.ytd-playlist-panel-renderer,
    body.is-watching #header-contents, 
    body.is-watching .header.ytd-playlist-panel-renderer,
    body.is-watching ytd-playlist-panel-video-renderer,
    body.is-watching ytd-playlist-panel-video-renderer:hover,
    body.is-watching ytd-watch-metadata,
    body.is-watching ytd-comments,
    body.is-watching #masthead-container {
        background: transparent !important;
        background-color: transparent !important;
        border: none !important;
        box-shadow: none !important;
    }


    /* Popups and Search Suggestions - Keep Opaque */
    .sbdd_a, .sbsb_a, .sbdd_b, .sbpki, .gstl_50, .sbqs_c, 
    ytd-search-suggestion-renderer, ytd-search-suggestions-section-renderer,
    ytd-popup-container, tp-yt-iron-dropdown, ytd-multi-page-menu-renderer {
        background: #0f0f0f !important;
        opacity: 1 !important;
        z-index: 2000 !important;
    }

    /* Video Player and UI preservation */
    #movie_player, .html5-video-player {
        background: transparent !important;
    }
    
    ytd-thumbnail, yt-image, img, ytd-moving-thumbnail-renderer {
        background-color: transparent !important;
        visibility: visible !important;
    }

    /* --- MASTHEAD MINIMALIST ENGINE --- */
    ytd-masthead #center {
        display: none !important;
    }
    
    body.search-active ytd-masthead #center {
        display: flex !important;
        max-width: 600px !important;
        margin: 0 20px !important;
        flex: 1 1 auto !important;
    }
    
    body.search-active ytd-masthead #end {
        display: flex !important;
        flex: 0 0 auto !important;
    }
    
    body.search-active ytd-masthead #start {
        flex: 0 0 auto !important;
    }

    #custom-search-trigger {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 40px;
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        margin-right: 10px;
        transition: all 0.3s ease;
    }


    
    #custom-search-trigger:hover {
        background: rgba(255,255,255,0.1);
        transform: scale(1.05);
    }
    
    #custom-search-trigger svg {
        fill: #fff;
        width: 20px;
        height: 20px;
    }

    body:not(.is-watching) ytd-app { background: #0f0f0f !important; }

    #cinematics { display: none !important; }

    #ambient-fullscreen-glow {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: -1;
        pointer-events: none;
        transform: translateZ(0) scale(1.5);
        backface-visibility: hidden;
        will-change: background;
        filter: blur(80px) saturate(150%) brightness(110%);
        opacity: 0;
        transition: background 0.5s ease, opacity 0.8s ease-in-out;
    }
  `;
  document.head.appendChild(style);

  setInterval(runUiPiercer, 500);

  const checkInterval = setInterval(() => {
    if (document.querySelector('video')) {
      initGlow();
      clearInterval(checkInterval);
    }
  }, 1000);
}

let debounceTimer;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {}, 1000);
});

function init() {
  if (window.__ytModInitialized) return;
  
  if (!document.body || !document.head) {
    setTimeout(init, 100);
    return;
  }
  
  // Wait for core elements
  const criticalElements = [
    'ytd-masthead',
    '#secondary'
  ];
  
  const isReady = criticalElements.every(selector => !!document.querySelector(selector));
  
  if (!isReady) {
    setTimeout(init, 500);
    return;
  }

  window.__ytModInitialized = true;
  window.__ytModStartTime = Date.now();
  logInfo('Initializing Layout Engines...');

  setupAmbientGlow();
  
  // Continuous check for custom search injection
  setInterval(setupCustomSearch, 1000);
  setupCustomSearch();

  observer.observe(document.body, { childList: true, subtree: true });
  
  setTimeout(runUiPiercer, 500);
}







// Use a more reliable way to detect when we can start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


// --- DOM-LEVEL AD INTERCEPTOR ---
// Catches any ads that slip through the network layer (e.g., server-side stitched ads)
function runAdInterceptor() {
  const player = document.querySelector('#movie_player');
  if (!player) return;

  // 1. Auto-click "Skip Ad" button
  const skipBtn = player.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, [class*="skip-button"]');
  if (skipBtn) {
    skipBtn.click();
    logInfo('[AdBlock] Skipped ad via skip button');
    return; // Stop here if we skipped
  }

  // 2. Detect if an ad is actively playing
  // We check for 'ad-showing' on the player and also look for ad badges
  const isAdShowing = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
  const hasAdBadge = !!player.querySelector('.ytp-ad-badge, .ytp-ad-simple-ad-badge');
  
  const isAdPlaying = isAdShowing || hasAdBadge;

  if (isAdPlaying) {
    const video = player.querySelector('video');
    if (video) {
      if (!video.muted) {
        video.muted = true;
        logInfo('[AdBlock] Ad detected — muting');
      }
      // Speed up ad playback significantly
      if (video.playbackRate !== 16) {
        video.playbackRate = 16;
        logInfo('[AdBlock] Speeding up ad');
      }
    }
    
    // Hide ad overlays
    const overlays = player.querySelectorAll('.ytp-ad-player-overlay, .ytp-ad-overlay-container, .ytp-ad-message-container');
    overlays.forEach(el => { if (el.style.display !== 'none') el.style.display = 'none'; });
  } else {
    // Restore normal playback if it was an ad before
    const video = player.querySelector('video');
    if (video && video.playbackRate === 16) {
      video.playbackRate = 1;
      video.muted = false; // Unmute when ad is gone
      logInfo('[AdBlock] Ad gone — restoring normal playback');
    }
  }

  // 3. Remove banner ads from the page (very carefully)
  const bannerAds = document.querySelectorAll(
    'ytd-ad-slot-renderer, ytd-rich-item-renderer[is-ad], #masthead-ad'
  );
  bannerAds.forEach(el => {
    if (el.style.display !== 'none') {
      el.style.display = 'none';
    }
  });
}

// Run every 400ms to be slightly less CPU intensive
setInterval(runAdInterceptor, 400);

