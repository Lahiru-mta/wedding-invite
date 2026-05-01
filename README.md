# 🪷 Lahiru & Dushiya — Wedding Invitation

Personalised wedding invitation with:
- 🎬 Video cover (temple door opening) with green-screen transparency
- 💌 Watercolour floral invitation card (matching the image style)
- 📍 Location section with Google Maps button
- 🕐 Animated event timeline
- 💬 WhatsApp contact button per guest

---

## 🎬 Adding Your Video

1. Export your temple door video with a **green background** (chroma key)
2. Place the file in `public/videos/`:
   - `public/videos/temple-door.webm` ← preferred (smaller file, better browser support)
   - `public/videos/temple-door.mp4` ← fallback
3. The video uses CSS `mix-blend-mode: multiply` so the green/white background becomes transparent against the watercolour background

**Recommended export settings:**
- Resolution: 1080×1920 (portrait/vertical)
- Format: WebM (VP9) for best results
- Green screen background: #00FF00 or pure white works even better with multiply blend

---

## 🚀 Deploy to Vercel

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "Wedding invite"
# Create repo on github.com then:
git remote add origin https://github.com/YOUR_USERNAME/wedding-invite.git
git push -u origin main

# 2. Go to vercel.com → New Project → Import → Deploy
# Your site: https://your-project.vercel.app
```

---

## 👥 Managing Guests

### guests.json format
```json
{
  "a1b2": {
    "name": "Dr. Lal",
    "contactName": "Lahiru",
    "contactNumber": "+94771234567"
  }
}
```
- `name` — shown as "Dear [name]" in the invitation
- `contactName` — shown in the contact section & WhatsApp button
- `contactNumber` — WhatsApp number (include country code)

### Add a guest
```bash
node add-guest.js "Dr. Perera" "Lahiru" "+94771234567"
```

### Print all invite links
```bash
BASE_URL=https://yoursite.vercel.app node generate-links.js
```

---

## 📁 Project Structure
```
wedding-invite/
├── data/guests.json           ← Guest list
├── public/videos/             ← Put your temple door video here
│   ├── temple-door.webm
│   └── temple-door.mp4
├── pages/
│   ├── index.js               ← Home
│   ├── api/guest.js           ← Guest lookup API
│   └── invite/[code].js       ← Invitation page
├── styles/globals.css
├── add-guest.js
└── generate-links.js
```

---

*Lahiru & Dushiya · 24 May 2026 · Crown Regency, Badulla*
