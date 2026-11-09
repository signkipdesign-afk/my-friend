# 📞 MyFriend - Web Voice Calling App

A modern, fast, and simple peer-to-peer (P2P) voice calling web application built with WebRTC. Users can sign in with their Gmail address or use pre-configured demo accounts. Enter a friend's username to send a voice call request, and start talking once they accept the call.

---

## 🌟 Features

1. **Authentication**:
   - **Gmail Sign In**: Enter your Gmail address (e.g. `signkipdesign@gmail.com`) to instantly create your profile and start calling.
   - **2 Demo Accounts**:
     - 👤 **Demo 1**: Rahul Kumar (`@rahul` • `rahul.demo@gmail.com`)
     - 👤 **Demo 2**: Anjali Menon (`@anjali` • `anjali.demo@gmail.com`)
   - **Custom Guest Login**: Enter any display name and custom username.

2. **Call Request & Acceptance Flow**:
   - Type your friend's username and click **Send Voice Call Request**.
   - Caller hears outgoing dial tone; receiver's phone/browser plays pleasant incoming ringtone.
   - Receiver receives an incoming call modal with **Accept** and **Decline** options.
   - Voice call connects only after the receiver clicks **Accept**.
   - If declined, caller receives an instant notification and dial tone stops.

3. **In-Call Controls**:
   - 🎙️ **Mute / Unmute** microphone toggle.
   - ⏱️ Live call duration timer (`00:01`, `00:02`...).
   - 🌊 Real-time voice waveform visualizer (Web Audio API Analyser).
   - 🛑 **End Call** button.

4. **Serverless Architecture**:
   - Powered by WebRTC and PeerJS cloud signaling.
   - Runs client-side on GitHub Pages with HTTPS for crystal-clear microphone audio.

---

## 🚀 Live Website

Access the live application at:
👉 **[https://signkipdesign-afk.github.io/my-friend/](https://signkipdesign-afk.github.io/my-friend/)**

---

## 💻 Run Locally

1. On Windows, double-click **`start.bat`**.
   Or run the following PowerShell command in the project directory:
   ```powershell
   powershell -ExecutionPolicy Bypass -File server.ps1
   ```
2. Your default browser will automatically open `http://localhost:3000`.

---

## 🧪 Testing Between Two Accounts

1. In Tab 1, enter your Gmail: **`signkipdesign@gmail.com`** and click **Sign In**.
2. Open an **Incognito window (Private Tab)** or open the link on your mobile phone: `https://signkipdesign-afk.github.io/my-friend/`
3. Sign in as **Anjali** (or another demo account).
4. From your tab, enter **`anjali`** and click **Send Voice Call Request**.
5. The other tab/device will ring with sound. Click **Accept** to connect the call!
