// ================================================
// US Portfolio Grow - Backend Server (3-API Auto-Engine)
// ================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

// API Keys - ดึงจาก Environment Variables
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || "h3faYrol9E4DEgv99Fj532HblSIA3fAb";
const EODHD_API_KEY = process.env.EODHD_API_KEY || "69cec4d00ed1f6.56559517";
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || "d77k3npr01qp6afltiggd77k3npr01qp6afltih0";

app.use(cors());
app.use(express.json());

// ================================================
// ฟังก์ชันดึงราคาหุ้นแบบสลับเจ้าอัตโนมัติ (Failover Logic)
// ================================================
async function getStockPrice(symbol) {
  // 1. ลอง Polygon (ตัวหลัก - แม่นยำที่สุด)
  try {
    const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`);
    const data = await res.json();
    if (data.results && data.results[0]) {
      const p = data.results[0];
      return { 
        price: p.c, 
        change: p.c - p.o, 
        changesPercentage: ((p.c - p.o) / p.o) * 100,
        high: p.h,
        low: p.l,
        volume: p.v,
        source: "Polygon"
      };
    }
  } catch (e) { 
    console.log(`Polygon failed for ${symbol}:`, e.message); 
  }

  // 2. ลอง EODHD (ตัวสำรอง 1)
  try {
    const res = await fetch(`https://eodhd.com/api/real-time/${symbol}.US?api_token=${EODHD_API_KEY}&fmt=json`);
    const data = await res.json();
    if (data && data.code) {
      return { 
        price: data.close, 
        change: data.change, 
        changesPercentage: data.change_p,
        high: data.high,
        low: data.low,
        volume: data.volume,
        source: "EODHD"
      };
    }
  } catch (e) { 
    console.log(`EODHD failed for ${symbol}:`, e.message); 
  }

  // 3. ลอง Finnhub (ตัวสำรอง 2)
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
    const data = await res.json();
    if (data.c) {
      return { 
        price: data.c, 
        change: data.d, 
        changesPercentage: data.dp,
        high: data.h,
        low: data.l,
        previousClose: data.pc,
        source: "Finnhub"
      };
    }
  } catch (e) { 
    console.log(`Finnhub failed for ${symbol}:`, e.message); 
  }

  return null;
}

// ================================================
// ดึงข้อมูลบริษัท (Company Profile)
// ================================================
async function getCompanyProfile(symbol) {
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
    const data = await res.json();
    if (data && data.name) {
      return {
        name: data.name,
        logo: data.logo,
        industry: data.finnhubIndustry,
        marketCap: data.marketCapitalization,
        exchange: data.exchange
      };
    }
  } catch (e) {
    console.log(`Company profile failed for ${symbol}`);
  }
  return null;
}

// ================================================
// ดึงข้อมูลปันผล
// ================================================
async function getDividends(symbol) {
  try {
    const res = await fetch(`https://eodhd.com/api/div/${symbol}.US?api_token=${EODHD_API_KEY}&fmt=json`);
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.slice(0, 24); // ย้อนหลัง 24 งวด (2 ปี)
    }
  } catch (e) {
    console.log(`Dividend fetch error for ${symbol}`);
  }
  return [];
}

// ================================================
// API Endpoints
// ================================================

// ดึงข้อมูลหุ้นเดี่ยว
app.get("/api/stock/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  
  const [priceData, profile, dividends] = await Promise.all([
    getStockPrice(symbol),
    getCompanyProfile(symbol),
    getDividends(symbol)
  ]);

  if (!priceData) {
    return res.status(404).json({ error: "Data unavailable for " + symbol });
  }

  res.json({
    symbol,
    price: priceData.price,
    change: priceData.change,
    changesPercentage: priceData.changesPercentage,
    high: priceData.high,
    low: priceData.low,
    volume: priceData.volume,
    companyName: profile?.name || symbol,
    logo: profile?.logo,
    industry: profile?.industry,
    marketCap: profile?.marketCap,
    dividends: dividends,
    source: priceData.source
  });
});

// ดึงข้อมูลหลายหุ้นพร้อมกัน (Batch)
app.post("/api/stocks/batch", async (req, res) => {
  const { symbols } = req.body;
  if (!symbols || !Array.isArray(symbols)) {
    return res.status(400).json({ error: "Invalid symbols array" });
  }

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const priceData = await getStockPrice(symbol.toUpperCase());
      if (priceData) {
        return {
          symbol: symbol.toUpperCase(),
          price: priceData.price,
          change: priceData.change,
          changesPercentage: priceData.changesPercentage
        };
      }
      return { symbol: symbol.toUpperCase(), error: true };
    })
  );

  res.json(results);
});

// ค้นหาหุ้น
app.get("/api/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);

  try {
    const searchRes = await fetch(`https://finnhub.io/api/v1/search?q=${q}&token=${FINNHUB_API_KEY}`);
    const data = await searchRes.json();
    
    if (data.result) {
      const filtered = data.result
        .filter(i => !i.symbol.includes(".") && i.type === "Common Stock")
        .map(i => ({ 
          symbol: i.symbol, 
          description: i.description 
        }));
      return res.json(filtered.slice(0, 15));
    }
    res.json([]);
  } catch (e) {
    console.log("Search error:", e.message);
    res.json([]);
  }
});

// ดึง Market Overview (ดัชนีหลัก)
app.get("/api/market/overview", async (req, res) => {
  const indices = ["SPY", "QQQ", "DIA", "IWM"];
  
  const results = await Promise.all(
    indices.map(async (symbol) => {
      const data = await getStockPrice(symbol);
      return {
        symbol,
        price: data?.price,
        change: data?.change,
        changesPercentage: data?.changesPercentage
      };
    })
  );

  res.json(results);
});

// ตรวจสอบสถานะ API
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    apis: {
      polygon: !!POLYGON_API_KEY,
      eodhd: !!EODHD_API_KEY,
      finnhub: !!FINNHUB_API_KEY
    }
  });
});

// สำหรับ Production บน Render
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/build", "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Server ready on port ${PORT}`);
  console.log(`📊 3-API Failover Active: Polygon → EODHD → Finnhub`);
});
