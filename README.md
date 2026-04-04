# 📊 Portfolio Grow US

คำนวณผลตอบแทนและเงินปันผลจากการลงทุนในหุ้นอเมริกา

![Status](https://img.shields.io/badge/Status-Ready-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

- 🔍 ค้นหาหุ้นอเมริกาทั้งตลาด (US Stocks, ETFs)
- 📈 คำนวณผลตอบแทนและเงินปันผล
- 📊 กราฟการเติบโตของพอร์ต
- 💰 กราฟเงินปันผลรายปี (หลังหักภาษี 10%)
- 🔄 ระบบ 3-API Failover อัตโนมัติ

## 🚀 Tech Stack

- **Frontend:** React 18, Recharts
- **Backend:** Node.js, Express
- **APIs:** Polygon.io, EODHD, Finnhub
- **Hosting:** Render

## 📦 Installation

### 1. Clone Repository

```bash
git clone https://github.com/navykao/us-portfolio-grow.git
cd us-portfolio-grow
```

### 2. Install Dependencies

```bash
npm run install-all
```

### 3. Setup Environment

คัดลอก `.env.example` เป็น `server/.env`:

```bash
cp .env.example server/.env
```

### 4. Run Development

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## 🌐 Deploy to Render

### วิธีที่ 1: Auto Deploy (แนะนำ)

1. Push โค้ดขึ้น GitHub
2. ไป [Render Dashboard](https://dashboard.render.com)
3. New → Web Service → Connect Repository
4. ตั้งค่า:
   - **Build Command:** `cd client && npm install && npm run build && cd ../server && npm install`
   - **Start Command:** `cd server && npm start`
5. เพิ่ม Environment Variables:
   - `POLYGON_API_KEY`
   - `EODHD_API_KEY`
   - `FINNHUB_API_KEY`
   - `NODE_ENV` = production

### วิธีที่ 2: Blueprint (render.yaml)

1. Push โค้ดขึ้น GitHub
2. Render → New → Blueprint
3. เลือก Repository
4. เพิ่ม Environment Variables ใน Dashboard

## 🔑 API Keys

| Provider | ประเภท | Link |
|----------|--------|------|
| Polygon.io | ตัวหลัก | https://polygon.io |
| EODHD | ตัวสำรอง 1 | https://eodhd.com |
| Finnhub | ตัวสำรอง 2 | https://finnhub.io |

## 📁 Project Structure

```
us-portfolio-grow/
├── client/                 # React Frontend
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js         # Main Component
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
├── server/                 # Express Backend
│   ├── index.js           # API Server
│   ├── package.json
│   └── .env               # API Keys (local)
├── .env.example
├── .gitignore
├── package.json
├── render.yaml
└── README.md
```

## 🛠️ API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stock/:symbol` | GET | ดึงข้อมูลหุ้น + ปันผล |
| `/api/stocks/batch` | POST | ดึงหลายหุ้นพร้อมกัน |
| `/api/search?q=` | GET | ค้นหาหุ้น |
| `/api/market/overview` | GET | ดัชนีตลาด (SPY, QQQ) |
| `/api/health` | GET | ตรวจสถานะ API |

## 📝 License

MIT License - Free to use and modify

## 👤 Author

**navykao** - [GitHub](https://github.com/navykao)
