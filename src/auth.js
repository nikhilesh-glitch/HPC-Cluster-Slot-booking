/**
 * HPC Slot Booking System - Authentication & Config Management
 * Handles GitHub PAT, repo parameters, and local faculty profiles.
 */

const STORAGE_KEY_AUTH = 'hpc_cluster_auth';
const STORAGE_KEY_PROFILE = 'hpc_faculty_profile';

export const AuthManager = {
  /**
   * Retrieves saved GitHub API configuration.
   */
  getConfig() {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (!raw) {
      return {
        token: '',
        owner: '',
        repo: '',
        branch: 'main',
        filePath: 'bookings.json',
        isConfigured: false
      };
    }
    try {
      const parsed = JSON.parse(raw);
      return {
        token: parsed.token || '',
        owner: parsed.owner || '',
        repo: parsed.repo || '',
        branch: parsed.branch || 'main',
        filePath: parsed.filePath || 'bookings.json',
        isConfigured: Boolean(parsed.token && parsed.owner && parsed.repo)
      };
    } catch (e) {
      console.error('Failed to parse auth config:', e);
      return { token: '', owner: '', repo: '', branch: 'main', filePath: 'bookings.json', isConfigured: false };
    }
  },

  /**
   * Saves GitHub API configuration.
   */
  saveConfig(config) {
    const cleaned = {
      token: (config.token || '').trim(),
      owner: (config.owner || '').trim(),
      repo: (config.repo || '').trim(),
      branch: (config.branch || 'main').trim(),
      filePath: (config.filePath || 'bookings.json').trim()
    };
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(cleaned));
    return this.getConfig();
  },

  /**
   * Clears saved credentials.
   */
  clearConfig() {
    localStorage.removeItem(STORAGE_KEY_AUTH);
  },

  /**
   * Retrieves default faculty profile for pre-filling forms.
   */
  getProfile() {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (!raw) {
      return { name: '', email: '', department: '' };
    }
    try {
      return JSON.parse(raw);
    } catch {
      return { name: '', email: '', department: '' };
    }
  },

  /**
   * Saves default faculty profile.
   */
  saveProfile(profile) {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  },

  /**
   * Validates a GitHub PAT by querying the GitHub user endpoint.
   */
  async testConnection(token, owner, repo) {
    try {
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!userRes.ok) {
        throw new Error(`Invalid GitHub Token (Status ${userRes.status}). Ensure it has 'repo' or 'contents:write' scope.`);
      }

      const userData = await userRes.json();

      // Check repository access
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!repoRes.ok) {
        throw new Error(`Cannot access repository ${owner}/${repo}. Check permissions and spelling.`);
      }

      const repoData = await repoRes.json();
      const canPush = repoData.permissions ? repoData.permissions.push : true;

      return {
        success: true,
        user: userData.login,
        avatar: userData.avatar_url,
        canPush: canPush,
        repoFullName: repoData.full_name
      };
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }
};
