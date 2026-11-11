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
        // Use session storage for clean tab-level session isolation
        const saved = sessionStorage.getItem(this.storageKey);
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

    // Friends Management
    getFriendsKey() {
        return this.currentUser ? `myfriend_friends_${this.currentUser.username.toLowerCase()}` : null;
    }

    getPendingKey() {
        return this.currentUser ? `myfriend_pending_req_${this.currentUser.username.toLowerCase()}` : null;
    }

    getFriends() {
        const key = this.getFriendsKey();
        if (!key) return [];
        const saved = localStorage.getItem(key);
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        // Defaults for demo users
        if (this.currentUser.username === 'rahul') {
            return [{
                username: 'anjali',
                name: 'Anjali Menon',
                email: 'anjali.demo@gmail.com',
                avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=anjali'
            }];
        } else if (this.currentUser.username === 'anjali') {
            return [{
                username: 'rahul',
                name: 'Rahul Kumar',
                email: 'rahul.demo@gmail.com',
                avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=rahul'
            }];
        }
        return [];
    }

    addFriend(friend) {
        const key = this.getFriendsKey();
        if (!key || !friend || !friend.username) return;
        const friends = this.getFriends();
        const exists = friends.some(f => f.username.toLowerCase() === friend.username.toLowerCase());
        if (!exists) {
            friends.unshift({
                username: friend.username.toLowerCase(),
                name: friend.name || friend.username,
                email: friend.email || `${friend.username}@gmail.com`,
                avatar: friend.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.username.toLowerCase()}`
            });
            localStorage.setItem(key, JSON.stringify(friends));
        }
        return friends;
    }

    removeFriend(username) {
        const key = this.getFriendsKey();
        if (!key) return;
        let friends = this.getFriends();
        friends = friends.filter(f => f.username.toLowerCase() !== username.toLowerCase());
        localStorage.setItem(key, JSON.stringify(friends));
        return friends;
    }

    getPendingRequests() {
        const key = this.getPendingKey();
        if (!key) return [];
        const saved = localStorage.getItem(key);
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return [];
    }

    addPendingRequest(fromUser) {
        const key = this.getPendingKey();
        if (!key || !fromUser || !fromUser.username) return;
        const requests = this.getPendingRequests();
        const exists = requests.some(r => r.username.toLowerCase() === fromUser.username.toLowerCase());
        if (!exists) {
            requests.unshift(fromUser);
            localStorage.setItem(key, JSON.stringify(requests));
        }
        return requests;
    }

    removePendingRequest(fromUsername) {
        const key = this.getPendingKey();
        if (!key) return;
        let requests = this.getPendingRequests();
        requests = requests.filter(r => r.username.toLowerCase() !== fromUsername.toLowerCase());
        localStorage.setItem(key, JSON.stringify(requests));
        return requests;
    }
}

window.authManager = new AuthManager();
