// Authentication and User Profile Management

const DEMO_ACCOUNTS = [
    {
        id: 'rahul',
        name: 'Rahul Kumar',
        email: 'rahul.demo@gmail.com',
        username: 'rahul',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=rahul',
        color: '#3b82f6',
        targetFriend: 'anjali',
        targetFriendName: 'Anjali'
    },
    {
        id: 'anjali',
        name: 'Anjali Menon',
        email: 'anjali.demo@gmail.com',
        username: 'anjali',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=anjali',
        color: '#ec4899',
        targetFriend: 'rahul',
        targetFriendName: 'Rahul'
    }
];

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.storageKey = 'myfriend_current_user_session';
    }

    init() {
        // Check session storage first (allows testing 2 tabs on same browser), fallback to local storage
        const saved = sessionStorage.getItem(this.storageKey) || localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                this.currentUser = JSON.parse(saved);
            } catch (e) {
                this.currentUser = null;
            }
        }
    }

    loginAsDemo(username) {
        const demo = DEMO_ACCOUNTS.find(a => a.username.toLowerCase() === username.toLowerCase());
        if (demo) {
            this.setUser({
                id: demo.id,
                name: demo.name,
                email: demo.email,
                username: demo.username,
                avatar: demo.avatar,
                isDemo: true,
                targetFriend: demo.targetFriend,
                targetFriendName: demo.targetFriendName
            });
            return this.currentUser;
        }
        return null;
    }

    loginWithCustom(name, username, email = '') {
        const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (!cleanUser) return null;

        const user = {
            id: cleanUser,
            name: name.trim() || cleanUser,
            username: cleanUser,
            email: email.trim() || `${cleanUser}@gmail.com`,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUser}`,
            isDemo: false
        };
        this.setUser(user);
        return user;
    }

    loginWithGmail(email) {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) return null;

        const namePart = cleanEmail.split('@')[0];
        const cleanUser = namePart.replace(/[^a-z0-9_-]/g, '');
        const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

        const user = {
            id: cleanUser,
            name: displayName,
            username: cleanUser,
            email: cleanEmail,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUser}`,
            isGmail: true
        };
        this.setUser(user);
        return user;
    }

    // Google Sign-In with Google Identity Services (GIS) / OAuth 2.0 Credential
    handleGoogleCredentialResponse(response) {
        try {
            // Decode Google JWT credential
            const payload = this.parseJwt(response.credential);
            if (!payload || !payload.email) {
                throw new Error("Invalid Google credential payload");
            }

            const email = payload.email;
            const name = payload.name || email.split('@')[0];
            // Derive clean username from email (e.g. signkipdesign from signkipdesign@gmail.com)
            const cleanUser = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
            const avatar = payload.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUser}`;

            const user = {
                id: cleanUser,
                name: name,
                username: cleanUser,
                email: email,
                avatar: avatar,
                isGoogle: true
            };
            this.setUser(user);
            return user;
        } catch (err) {
            console.error("Google Login parsing failed:", err);
            return null;
        }
    }

    parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    }

    setUser(user) {
        this.currentUser = user;
        sessionStorage.setItem(this.storageKey, JSON.stringify(user));
        localStorage.setItem(this.storageKey, JSON.stringify(user));
    }

    logout() {
        this.currentUser = null;
        sessionStorage.removeItem(this.storageKey);
        localStorage.removeItem(this.storageKey);
    }

    getUser() {
        return this.currentUser;
    }

    isLoggedIn() {
        return !!this.currentUser;
    }
}

window.authManager = new AuthManager();
