document.addEventListener('DOMContentLoaded', () => {
  const connectBtn = document.getElementById('connectBtn');
  const statusMsg = document.getElementById('statusMsg');

  function showStatus(text, isError = false) {
    statusMsg.style.display = 'block';
    statusMsg.className = `status-msg ${isError ? 'error' : 'success'}`;
    statusMsg.textContent = text;
  }

  connectBtn.addEventListener('click', async () => {
    const name = document.getElementById('memberName').value.trim();
    const role = document.getElementById('memberRole').value.trim();
    const apiEndpoint = document.getElementById('apiEndpoint').value.trim();

    if (!name) {
      showStatus('Please enter member name.', true);
      return;
    }

    connectBtn.disabled = true;
    connectBtn.textContent = 'Capturing cookies...';

    try {
      // 1. Capture all cookies from linkedin.com
      chrome.cookies.getAll({ domain: 'linkedin.com' }, async (cookies) => {
        if (!cookies || cookies.length === 0) {
          connectBtn.disabled = false;
          connectBtn.textContent = 'Connect & Sync Account';
          showStatus('No LinkedIn cookies found. Please log into LinkedIn in this browser.', true);
          return;
        }

        const liAtCookie = cookies.find(c => c.name === 'li_at');
        if (!liAtCookie) {
          connectBtn.disabled = false;
          connectBtn.textContent = 'Connect & Sync Account';
          showStatus('li_at session cookie not found. Please re-login to LinkedIn.', true);
          return;
        }

        connectBtn.textContent = 'Posting to OneInbox...';

        // Format cookies array
        const formattedCookies = cookies.map(c => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly
        }));

        // 2. Post cookies and sales rep info to backend API
        try {
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name,
              role,
              cookies: formattedCookies
            })
          });

          const result = await response.json();

          if (response.ok && result.success) {
            connectBtn.textContent = 'Connected ✓';
            showStatus(`Account Connected! Synced ${result.account.syncedMessages || 0} messages.`);
          } else {
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect & Sync Account';
            showStatus(result.error || 'Failed to connect account.', true);
          }
        } catch (err) {
          connectBtn.disabled = false;
          connectBtn.textContent = 'Connect & Sync Account';
          showStatus(`Network Error: ${err.message}`, true);
        }
      });
    } catch (err) {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect & Sync Account';
      showStatus(`Error: ${err.message}`, true);
    }
  });
});
