# 🩸 Grifols Chattanooga — SMS Appointment Scheduling
### Powered by Vonage · Built for Return Donors

This system allows return donors to schedule a plasma donation appointment by sending a text message. The system automatically recognizes the donor by their phone number, suggests an appointment based on their history, and confirms the booking — all through SMS.

---

## 📋 How It Works (Plain English)

1. A donor texts any message to your Vonage number
2. The system looks them up by phone number
3. If they're active, it suggests an appointment based on their usual donation day and time
4. The donor replies YES to confirm or NO to pick a different date
5. Once confirmed, both the donor and center have the appointment details
6. At any time, the donor can reply STOP to opt out of all messages

---

## 🛠 What You Need Before Starting

You'll need accounts on two platforms — both are free to start:

### 1. Vonage Account (for SMS)
- Go to [vonage.com](https://www.vonage.com) and create a free account
- Once inside your dashboard, find and write down:
  - **API Key** (looks like: `a1b2c3d4`)
  - **API Secret** (looks like: `abc123XYZ456def`)
- Buy a virtual phone number (this is the number donors will text — costs ~$1/month)
- Write down that phone number too

### 2. Railway Account (for hosting)
- Go to [railway.app](https://railway.app) and sign up with your GitHub account
- Railway is where the server will live so Vonage can reach it 24/7
- The free tier is enough for a trial

### 3. GitHub Account (to connect your code to Railway)
- Go to [github.com](https://github.com) and create a free account
- You'll upload the code files here so Railway can run them

---

## 🚀 Step-by-Step Setup

### Step 1 — Download the code files
You should have received a folder called `grifols-sms` containing these files:
```
grifols-sms/
  index.js
  package.json
  .env.example
  src/
    donors.js
    centers.js
    scheduling.js
    vonage.js
    sessions.js
```

### Step 2 — Create your credentials file
1. Find the file called `.env.example` in the folder
2. Make a copy of it and rename the copy to `.env` (just remove "example")
3. Open `.env` in any text editor (Notepad on Windows, TextEdit on Mac)
4. Fill in your Vonage credentials:

```
VONAGE_API_KEY=paste_your_api_key_here
VONAGE_API_SECRET=paste_your_api_secret_here
VONAGE_FROM_NUMBER=+1XXXXXXXXXX
PORT=3000
```

⚠️ **Important:** Never share this `.env` file with anyone or upload it to GitHub.

### Step 3 — Upload to GitHub
1. Log into [github.com](https://github.com)
2. Click the **+** button (top right) → **New repository**
3. Name it `grifols-sms` and click **Create repository**
4. Upload all the files from your `grifols-sms` folder (drag and drop works)
5. **Do NOT upload the `.env` file** — only upload `.env.example`

### Step 4 — Deploy to Railway
1. Log into [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `grifols-sms` repository
4. Railway will automatically detect it's a Node.js app and start deploying
5. Once deployed, click on your project → **Settings** → find your **Public URL**
   - It will look like: `https://grifols-sms-production.up.railway.app`
   - Copy this URL — you'll need it in the next step

### Step 5 — Add your credentials to Railway
Instead of uploading your `.env` file, you'll enter the values directly in Railway:
1. In your Railway project, click **Variables**
2. Add each variable one at a time:
   - `VONAGE_API_KEY` → your Vonage API key
   - `VONAGE_API_SECRET` → your Vonage API secret
   - `VONAGE_FROM_NUMBER` → your Vonage phone number (e.g. +14235550100)
3. Railway will automatically restart the server with your new credentials

### Step 6 — Connect Vonage to your server
This is the step that makes Vonage send texts to your server:
1. Log into your [Vonage Dashboard](https://dashboard.nexmo.com)
2. Go to **Phone Numbers** → click on your number
3. Under **Inbound Webhook**, paste your Railway URL + `/inbound`:
   ```
   https://grifols-sms-production.up.railway.app/inbound
   ```
4. Set the **HTTP Method** to `POST`
5. Click **Save**

✅ Your system is now live! Test it by texting your Vonage number from a phone.

---

## 🧪 Testing

To test the system, text your Vonage number from any phone. To simulate different donor scenarios, add test phone numbers to `src/donors.js`.

**Test the following flows:**
| Action | Expected Response |
|---|---|
| Text any message | Welcome message + appointment suggestion |
| Reply `YES` | Appointment confirmed |
| Reply `NO` | List of 4 alternate dates |
| Reply `1`–`4` | Available time slots for chosen date |
| Reply `STOP` | Opt-out confirmation, no further messages |
| Unknown number | "Not found" message with center phone number |

---

## 👥 Adding Real Donors

Open `src/donors.js` and add donors following this format:

```javascript
"+14235551234": {
  id: "GRF-XXXXX",
  name: "Full Name",
  firstName: "First",
  status: "active",       // "active" or "deferred"
  centerId: 1,
  donationHistory: [
    { date: "2026-03-10", time: "10:00 AM", dayOfWeek: 2 },
    // Add more history entries — most recent first
    // dayOfWeek: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  ],
},
```

**For deferred donors, also add:**
```javascript
  status: "deferred",
  deferralReason: "Recent illness",
  deferralUntil: "2026-04-01",
```

---

## ❓ Troubleshooting

**Donors aren't receiving texts**
- Double-check your Vonage API key and secret in Railway Variables
- Make sure your Vonage number is active and has SMS enabled
- Check the Railway logs (click **Deployments** → **View Logs**)

**Vonage isn't reaching the server**
- Make sure the webhook URL in Vonage ends with `/inbound`
- Make sure your Railway deployment is active (green status)

**The server crashed**
- Check Railway logs for error messages
- Make sure all 5 files in the `src/` folder were uploaded to GitHub

---

## 📞 Need Help?

Contact your developer or call the Grifols Chattanooga Plasma Center at **(423) 855-1085**.

---

*Grifols Chattanooga Plasma Center · 5744 Brainerd Rd, Chattanooga, TN 37411*
*SMS powered by Vonage*
