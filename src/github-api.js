/**
 * HPC Slot Booking System - GitHub Contents API & Persistence Layer
 * Implements direct Git commit read/write for bookings.json with fallback to local storage.
 */

import { AuthManager } from './auth.js';

let cachedSha = null;
const LOCAL_STORAGE_FALLBACK = 'hpc_fallback_bookings';

function utf8ToBase64(str) {
  return window.btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(str) {
  return decodeURIComponent(escape(window.atob(str.replace(/\s/g, ''))));
}

export const GitHubApi = {
  /**
   * Returns whether active mode is GitHub API or Local Fallback.
   */
  isLiveGithub() {
    const config = AuthManager.getConfig();
    return Boolean(config.token && config.owner && config.repo);
  },

  /**
   * Fetches latest bookings data from GitHub API or local fallback.
   */
  async getBookings() {
    const config = AuthManager.getConfig();

    if (config.token && config.owner && config.repo) {
      try {
        const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.filePath}?ref=${config.branch || 'main'}&t=${Date.now()}`;
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${config.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (res.ok) {
          const data = await res.json();
          cachedSha = data.sha;
          const jsonString = base64ToUtf8(data.content);
          const parsed = JSON.parse(jsonString);
          localStorage.setItem(LOCAL_STORAGE_FALLBACK, JSON.stringify(parsed));
          return {
            source: 'github',
            data: parsed,
            sha: cachedSha
          };
        } else {
          console.warn(`GitHub API read returned ${res.status}. Falling back to cached data.`);
        }
      } catch (err) {
        console.warn('GitHub API request failed, switching to local cache:', err);
      }
    }

    // Fallback: Try localStorage first, then static file './bookings.json'
    const localSaved = localStorage.getItem(LOCAL_STORAGE_FALLBACK);
    if (localSaved) {
      try {
        return {
          source: 'local_storage',
          data: JSON.parse(localSaved),
          sha: null
        };
      } catch (e) {
        console.error('Corrupted local storage data:', e);
      }
    }

    // Try relative fetch for bookings.json
    try {
      const staticRes = await fetch('./bookings.json?t=' + Date.now());
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        localStorage.setItem(LOCAL_STORAGE_FALLBACK, JSON.stringify(staticData));
        return {
          source: 'static_file',
          data: staticData,
          sha: null
        };
      }
    } catch (e) {
      console.warn('Could not load static bookings.json:', e);
    }

    // If completely empty, return default template
    return {
      source: 'empty_fallback',
      data: {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        nodes: {}
      },
      sha: null
    };
  },

  /**
   * Commits updated bookings to GitHub repository or updates local storage.
   */
  async updateBookings(updatedData, commitMessage) {
    const config = AuthManager.getConfig();
    updatedData.lastUpdated = new Date().toISOString();

    // Always update local fallback for instant UI response and offline safety
    localStorage.setItem(LOCAL_STORAGE_FALLBACK, JSON.stringify(updatedData));

    if (config.token && config.owner && config.repo) {
      const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.filePath}`;

      // Refresh SHA if missing
      if (!cachedSha) {
        try {
          const checkRes = await fetch(`${url}?ref=${config.branch || 'main'}&t=${Date.now()}`, {
            headers: {
              'Authorization': `Bearer ${config.token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            cachedSha = checkData.sha;
          }
        } catch (e) {
          console.warn('Could not fetch latest SHA:', e);
        }
      }

      const contentString = JSON.stringify(updatedData, null, 2);
      const payload = {
        message: commitMessage || `HPC Slot Update: ${new Date().toISOString()}`,
        content: utf8ToBase64(contentString),
        branch: config.branch || 'main'
      };

      if (cachedSha) {
        payload.sha = cachedSha;
      }

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!putRes.ok) {
        const errorJson = await putRes.json().catch(() => ({}));
        throw new Error(errorJson.message || `GitHub commit failed with status ${putRes.status}`);
      }

      const result = await putRes.json();
      cachedSha = result.content ? result.content.sha : null;

      return {
        success: true,
        source: 'github',
        commit: result.commit ? result.commit.sha : null
      };
    } else {
      // Local Demo Mode
      return {
        success: true,
        source: 'local_storage',
        note: 'Saved locally in browser (Configure GitHub PAT in Settings to sync to repo).'
      };
    }
  }
};
