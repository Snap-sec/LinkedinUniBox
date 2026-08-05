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

  // 1. Fetch cookies and query settingsApiMiniProfile
  async function initSessionCheck() {
    if (!chrome || !chrome.cookies) {
      showStatus('Chrome extension cookie permission missing.', true);
      return;
    }

    chrome.cookies.getAll({ domain: 'linkedin.com' }, async (cookies) => {
      if (!cookies || cookies.length === 0) {
        showStatus('No LinkedIn cookies found. Please log into LinkedIn in this browser.', true);
        return;
      }

      const liAtCookie = cookies.find(c => c.name === 'li_at');
      if (!liAtCookie) {
        showStatus('li_at session cookie not found. Please log into LinkedIn in this browser.', true);
        return;
      }

      const jsessionCookie = cookies.find(c => c.name === 'JSESSIONID');
      const csrfToken = jsessionCookie ? jsessionCookie.value.replace(/"/g, '') : '';
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      // Query settingsApiMiniProfile directly from extension
      try {
        const miniProfileRes = await fetch('https://www.linkedin.com/mysettings-api/settingsApiMiniProfile', {
          headers: {
            'Cookie': cookieHeader,
            'csrf-token': csrfToken,
            'accept': 'application/json, text/plain, */*'
          }
        });

        if (miniProfileRes.ok) {
          const profileData = await miniProfileRes.json();
          if (profileData && profileData.data) {
            const data = profileData.data;
            const firstName = data.firstName || '';
            const lastName = data.lastName || '';
            const fullName = `${firstName} ${lastName}`.trim();
            if (fullName) detectedProfile.name = fullName;
            detectedProfile.role = data.headline?.trim() || 'SDR';

            if (data.picture && data.picture.rootUrl && Array.isArray(data.picture.artifacts) && data.picture.artifacts.length > 0) {
              const artifact = data.picture.artifacts.find(a => a.width === 200) || data.picture.artifacts[0];
              if (artifact && artifact.fileIdentifyingUrlPathSegment) {
                detectedProfile.avatar = `${data.picture.rootUrl}${artifact.fileIdentifyingUrlPathSegment}`;
              }
            }
          }
        }
      } catch (err) {
        console.warn('MiniProfile fetch error in extension (backend fallback active):', err);
      }

      // Display detected profile card
      accountCard.style.display = 'flex';
      accountName.textContent = detectedProfile.name || 'LinkedIn Member';
      accountRole.textContent = detectedProfile.role || 'SDR';
      if (detectedProfile.avatar) {
        accountAvatar.src = detectedProfile.avatar;
      }

      // Auto submit cookies to platform backend
      autoSubmitCookies(cookies);
    });
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
      httpOnly: c.httpOnly
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
