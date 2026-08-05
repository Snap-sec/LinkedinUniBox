document.addEventListener('DOMContentLoaded', async () => {
  const connectBtn = document.getElementById('connectBtn');
  const statusMsg = document.getElementById('statusMsg');
  const accountCard = document.getElementById('accountCard');
  const accountAvatar = document.getElementById('accountAvatar');
  const accountName = document.getElementById('accountName');
  const accountRole = document.getElementById('accountRole');
  const apiEndpointInput = document.getElementById('apiEndpoint');

  let detectedProfile = { name: '', role: 'SDR', avatar: '' };

  function showStatus(text, isError = false) {
    statusMsg.style.display = 'block';
    statusMsg.className = `status-msg ${isError ? 'error' : 'success'}`;
    statusMsg.textContent = text;
  }

  // Get ALL LinkedIn cookies across all subdomains (.www.linkedin.com, www.linkedin.com, .linkedin.com, linkedin.com)
  async function getAllLinkedinCookies() {
    const cookieMap = new Map();

    // Strategy A: Global query for all cookies in browser profile
    try {
      const allBrowserCookies = await new Promise(resolve => chrome.cookies.getAll({}, resolve));
      if (allBrowserCookies && Array.isArray(allBrowserCookies)) {
        for (const c of allBrowserCookies) {
          if (c.domain && c.domain.includes('linkedin.com')) {
            const key = `${c.name}:${c.domain}:${c.path || '/'}`;
            cookieMap.set(key, c);
          }
        }
      }
    } catch (e) {
      console.warn('Global cookie fetch failed:', e);
    }

    // Strategy B: Specific URL & domain targets as fallback
    const targets = [
      { url: 'https://www.linkedin.com' },
      { url: 'https://linkedin.com' },
      { url: 'https://www.linkedin.com/mysettings-api/settingsApiMiniProfile' },
      { domain: 'linkedin.com' },
      { domain: '.linkedin.com' },
      { domain: 'www.linkedin.com' },
      { domain: '.www.linkedin.com' }
    ];

    for (const target of targets) {
      try {
        const cookies = await new Promise(resolve => chrome.cookies.getAll(target, resolve));
        if (cookies && Array.isArray(cookies)) {
          for (const c of cookies) {
            const key = `${c.name}:${c.domain}:${c.path || '/'}`;
            if (!cookieMap.has(key)) {
              cookieMap.set(key, c);
            }
          }
        }
      } catch (e) {
        console.warn('Targeted cookie query failed:', target, e);
      }
    }

    const result = Array.from(cookieMap.values());
    console.log(`[Extension Cookie Collector] Captured ${result.length} total LinkedIn cookies.`);
    return result;
  }

  // 1. Fetch comprehensive cookies and query profile endpoints
  async function initSessionCheck() {
    if (!chrome || !chrome.cookies) {
      showStatus('Chrome extension cookie permission missing.', true);
      return;
    }

    const cookies = await getAllLinkedinCookies();
    if (!cookies || cookies.length === 0) {
      showStatus('No LinkedIn cookies found. Please log into LinkedIn in this browser.', true);
      return;
    }

    const liAtCookie = cookies.find(c => c.name === 'li_at' && c.value);
    if (!liAtCookie) {
      showStatus('li_at session cookie not found. Please log into LinkedIn in this browser.', true);
      return;
    }

    const jsessionCookie = cookies.find(c => c.name === 'JSESSIONID' && c.value);
    const csrfToken = jsessionCookie ? jsessionCookie.value.replace(/"/g, '') : '';

    // Method 1: Query settingsApiMiniProfile with credentials include
    try {
      const miniProfileRes = await fetch('https://www.linkedin.com/mysettings-api/settingsApiMiniProfile', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'csrf-token': csrfToken,
          'accept': 'application/json, text/plain, */*'
        }
      });

      if (miniProfileRes.ok) {
        const profileData = await miniProfileRes.json();
        const data = profileData.data || profileData;
        if (data && (data.firstName || data.lastName)) {
          const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
          if (fullName) detectedProfile.name = fullName;
          if (data.headline) detectedProfile.role = data.headline.trim();

          if (data.picture && data.picture.rootUrl && Array.isArray(data.picture.artifacts) && data.picture.artifacts.length > 0) {
            const artifact = data.picture.artifacts.find(a => a.width === 200) || data.picture.artifacts[0];
            if (artifact && artifact.fileIdentifyingUrlPathSegment) {
              detectedProfile.avatar = `${data.picture.rootUrl}${artifact.fileIdentifyingUrlPathSegment}`;
            }
          }
        }
      }
    } catch (err) {
      console.warn('settingsApiMiniProfile fetch error in extension:', err);
    }

    // Method 2: Query voyager/api/me as fallback
    if (!detectedProfile.name) {
      try {
        const meRes = await fetch('https://www.linkedin.com/voyager/api/me', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'csrf-token': csrfToken,
            'accept': 'application/json, text/plain, */*',
            'x-restli-protocol-version': '2.0.0'
          }
        });

        if (meRes.ok) {
          const meData = await meRes.json();
          const mini = meData.miniProfile || meData.data?.miniProfile || meData;
          if (mini && (mini.firstName || mini.lastName)) {
            detectedProfile.name = `${mini.firstName || ''} ${mini.lastName || ''}`.trim();
            if (mini.occupation) detectedProfile.role = mini.occupation.trim();
          }
        }
      } catch (err) {
        console.warn('Voyager /me fetch error in extension:', err);
      }
    }

    // Method 3: DOM Inspection on active tab if user is on linkedin.com
    if (!detectedProfile.name && chrome.tabs) {
      try {
        const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
        if (tabs && tabs[0] && tabs[0].url && tabs[0].url.includes('linkedin.com')) {
          const results = await new Promise(resolve => {
            if (chrome.scripting) {
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => {
                  const img = document.querySelector('img.global-nav__me-photo, img[alt^="Profile photo of"]');
                  if (img && img.alt) {
                    return img.alt.replace(/^Profile photo of\s*/i, '').trim();
                  }
                  const nameEl = document.querySelector('.global-nav__me-photo-img, .profile-rail-card__actor-link');
                  if (nameEl && nameEl.textContent) {
                    return nameEl.textContent.trim();
                  }
                  return null;
                }
              }, resolve);
            } else {
              resolve(null);
            }
          });
          if (results && results[0] && results[0].result) {
            detectedProfile.name = results[0].result;
          }
        }
      } catch (e) {
        console.warn('Tab script execution error:', e);
      }
    }

    // Display detected profile card
    accountCard.style.display = 'flex';
    accountName.textContent = detectedProfile.name || 'LinkedIn Member';
    accountRole.textContent = detectedProfile.role || 'SDR';
    if (detectedProfile.avatar) {
      accountAvatar.src = detectedProfile.avatar;
    }

    // Auto submit cookies with detected name to platform backend
    autoSubmitCookies(cookies);
  }

  async function autoSubmitCookies(cookies) {
    const apiEndpoint = apiEndpointInput.value.trim();
    connectBtn.disabled = true;
    connectBtn.textContent = 'Syncing session cookies...';

    const formattedCookies = cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      expirationDate: c.expirationDate || null
    }));

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: detectedProfile.name,
          role: detectedProfile.role,
          cookies: formattedCookies
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        connectBtn.textContent = 'Session Connected ✓';
        if (result.account) {
          accountName.textContent = result.account.name || accountName.textContent;
          accountRole.textContent = result.account.role || accountRole.textContent;
          if (result.account.avatar) accountAvatar.src = result.account.avatar;
        }
        showStatus(`Connected & Synced! Account "${result.account?.name || 'LinkedIn'}" active.`);
      } else {
        connectBtn.disabled = false;
        connectBtn.textContent = 'Retry Connect & Sync';
        showStatus(result.error || 'Failed to sync session.', true);
      }
    } catch (err) {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Retry Connect & Sync';
      showStatus(`Network Error: ${err.message}`, true);
    }
  }

  connectBtn.addEventListener('click', () => {
    initSessionCheck();
  });

  // Run automatically when extension popup opens
  initSessionCheck();
});
