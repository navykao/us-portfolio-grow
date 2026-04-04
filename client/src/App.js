import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './index.css';

const POLYGON_KEY = process.env.REACT_APP_POLYGON_API_KEY;
const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_API_KEY;
const EODHD_KEY = process.env.REACT_APP_EODHD_API_KEY;

export default function App() {
  const [initialInvestment, setInitialInvestment] = useState(1000);
  const [monthlyContribution, setMonthlyContribution] = useState(200);
  const [annualIncreaseRate, setAnnualIncreaseRate] = useState(5);
  const [years, setYears] = useState(15);
  const [isReinvest, setIsReinvest] = useState(true);
  const [portfolio, setPortfolio] = useState([]);
  const [newTicker, setNewTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState(null);

  const totalAllocation = portfolio.reduce((sum, stock) => sum + parseFloat(stock.allocation || 0), 0);

  const fetchSmartData = async (symbol) => {
    if (!symbol) return;
    setLoading(true);
    let fetchedPrice = 100;
    let fetchedDivYield = 3.50;
    let fetchedCapGain = 7.00;
    let fetchedDivGrowth = 5.00;

    try {
      // 1. ดึงราคาปัจจุบัน (Finnhub)
      try {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
        const data = await res.json();
        if (data.c && data.c !== 0) fetchedPrice = data.c;
      } catch (e) { console.log("Finnhub Fallback"); }

      // 2. ดึงประวัติราคา 10 ปี (Polygon)
      try {
        const dateTo = new Date().toISOString().split('T')[0];
        const dateFrom = new Date(new Date().getFullYear() - 10, 0, 1).toISOString().split('T')[0];
        const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${dateFrom}/${dateTo}?adjusted=true&sort=asc&limit=1&apiKey=${POLYGON_KEY}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const oldP = data.results[0].c;
          fetchedCapGain = (Math.pow(fetchedPrice / oldP, 1 / 10) - 1) * 100;
        }
      } catch (e) { console.log("Polygon Fallback"); }

      // 3. ดึงประวัติปันผล (EODHD) - ระบบสำรอง Proxy 2 ชั้น
      try {
        const targetUrl = `https://eodhd.com/api/div/${symbol}.US?api_token=${EODHD_KEY}&fmt=json`;
        
        // ลองใช้ Proxy ตัวที่ 1 (AllOrigins)
        let res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
        
        // ถ้า Proxy ตัวแรกพัง (ไม่ใช่ 200 OK) ให้ลองตัวที่ 2 (CorsProxy.io)
        if (!res.ok) {
          console.log("AllOrigins failed, trying CorsProxy.io...");
          res = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
        }

        const dataObj = await res.json();
        
        // จัดการรูปแบบข้อมูล (AllOrigins จะห่อข้อมูลไว้ใน .contents แต่ CorsProxy จะส่งมาตรงๆ)
        let d = dataObj.contents ? JSON.parse(dataObj.contents) : dataObj;

        if (Array.isArray(d) && d.length > 0) {
          const annualDiv = d.slice(0, 4).reduce((sum, item) => sum + parseFloat(item.value), 0);
          fetchedDivYield = (annualDiv / fetchedPrice) * 100;
          const recentD = parseFloat(d[0].value);
          const oldD = parseFloat(d[d.length - 1].value);
          fetchedDivGrowth = (Math.pow(recentD / oldD, 1 / 10) - 1) * 100;
        }
      } catch (e) { 
        console.error("EODHD all proxies failed, using default dividend data");
      }

      const cleanVal = (val) => (isNaN(val) || !isFinite(val)) ? 0 : val.toFixed(2);

      const newStock = {
        symbol: symbol,
        price: fetchedPrice,
        divYield: cleanVal(fetchedDivYield),
        growthRate: cleanVal(fetchedCapGain),
        divGrowth: cleanVal(fetchedDivGrowth),
        allocation: portfolio.length === 0 ? 100 : 0,
        frequency: 4 
      };

      setPortfolio(prev => [...prev, newStock]);
      setNewTicker('');
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStock = () => {
    if (!newTicker) return;
    if (portfolio.length >= 8) return alert("จำกัดหุ้น 8 ตัวครับ");
    fetchSmartData(newTicker.toUpperCase());
  };

  const updateStock = (index, field, value) => {
    const newPort = [...portfolio];
    newPort[index][field] = value;
    setPortfolio(newPort);
  };

  const removeStock = (index) => setPortfolio(portfolio.filter((_, i) => i !== index));

  useEffect(() => {
    calculateReturns();
  }, [initialInvestment, monthlyContribution, annualIncreaseRate, years, portfolio, isReinvest]);

  const calculateReturns = () => {
    let currentTotal = parseFloat(initialInvestment) || 0;
    let currentMonthlyDeposit = parseFloat(monthlyContribution) || 0;
    let totalInvested = parseFloat(initialInvestment) || 0;
    let lastYearTotalDiv = 0;
    let yearlyData = [];
    let yearsToTarget = null;

    let avgDivYield = 0, avgPriceGrowth = 0, avgDivGrowth = 0;
    if (portfolio.length > 0 && totalAllocation > 0) {
      portfolio.forEach(s => {
        const w = (parseFloat(s.allocation) / totalAllocation);
        avgDivYield += (parseFloat(s.divYield) || 0) * w;
        avgPriceGrowth += (parseFloat(s.growthRate) || 0) * w;
        avgDivGrowth += (parseFloat(s.divGrowth) || 0) * w;
      });
    }

    const totalMonths = (parseInt(years) || 1) * 12;

    for (let m = 1; m <= totalMonths; m++) {
      currentTotal += currentMonthlyDeposit;
      totalInvested += currentMonthlyDeposit;

      let monthlyTotalDiv = 0;
      let monthlyTotalGrowth = 0;

      portfolio.forEach(stock => {
        const stockWeight = (parseFloat(stock.allocation) || 0) / 100;
        const stockValue = currentTotal * stockWeight;
        monthlyTotalGrowth += stockValue * ((parseFloat(stock.growthRate) || 0) / 100 / 12);
        
        const yearPassed = Math.floor((m - 1) / 12);
        const currentYield = (parseFloat(stock.divYield) || 0) * Math.pow(1 + ((parseFloat(stock.divGrowth) || 0) / 100), yearPassed);
        const payCycle = 12 / (parseInt(stock.frequency) || 4);
        
        if (m % payCycle === 0) {
          const divEarned = stockValue * (currentYield / 100 / (parseInt(stock.frequency) || 4));
          monthlyTotalDiv += divEarned;
          if (m > totalMonths - 12) lastYearTotalDiv += divEarned;
        }
      });

      if (isReinvest) {
        currentTotal += (monthlyTotalDiv + monthlyTotalGrowth);
      } else {
        currentTotal += monthlyTotalGrowth;
        const divCash = monthlyTotalDiv;
      }

      if (m % 12 === 0) {
        const yearNum = m / 12;
        const finalV = currentTotal + (isReinvest ? 0 : 0); // Logic simplified for display
        yearlyData.push({
          year: `ปีที่ ${yearNum}`,
          invested: Math.round(totalInvested),
          totalValue: Math.round(currentTotal)
        });
        if (currentTotal >= 35000 && yearsToTarget === null) yearsToTarget = yearNum;
        currentMonthlyDeposit *= (1 + (parseFloat(annualIncreaseRate) || 0) / 100);
      }
    }

    setChartData(yearlyData);
    setSummary({
      finalValue: currentTotal.toFixed(2),
      totalInvested: totalInvested.toFixed(2),
      compoundedReturns: (currentTotal - totalInvested).toFixed(2),
      avgDivYield: avgDivYield.toFixed(2),
      avgPriceGrowth: avgPriceGrowth.toFixed(2),
      avgDivGrowth: avgDivGrowth.toFixed(2),
      annualDividend: lastYearTotalDiv.toFixed(2),
      yearsToTarget
    });
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>📊 US Portfolio Master Pro</h1>
        <p>วิเคราะห์ปันผลทบต้นจากข้อมูลจริง (CORS Fixed)</p>
      </header>

      <div className="main-grid">
        <div className="control-panel">
          <div className="card drip-card">
            <div className="drip-flex">
              <div>
                <h3>🔄 ปันผลทบต้น (DRIP)</h3>
                <p style={{fontSize: '0.75rem', color: isReinvest ? '#10b981' : '#94a3b8'}}>
                  {isReinvest ? 'เปิด: ทบต้นอัตโนมัติ' : 'ปิด: รับเป็นเงินสด'}
                </p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={isReinvest} onChange={() => setIsReinvest(!isReinvest)} />
                <span className="slider round"></span>
              </label>
            </div>
          </div>

          <div className="card">
            <h3>⚙️ ตั้งค่าการลงทุน (USD)</h3>
            <div className="input-group"><label>เงินต้นเริ่มต้น</label><input type="number" value={initialInvestment} onChange={e => setInitialInvestment(e.target.value)} /></div>
            <div className="input-group"><label>เติมเงินรายเดือน</label><input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(e.target.value)} /></div>
            <div className="input-group"><label>เพิ่มเงินเติม/ปี (%)</label><input type="number" value={annualIncreaseRate} onChange={e => setAnnualIncreaseRate(e.target.value)} /></div>
            <div className="input-group"><label>ระยะเวลาลงทุน (ปี)</label><input type="number" value={years} onChange={e => setYears(e.target.value)} /></div>
          </div>

          <div className="card">
            <div className="card-header-flex">
              <h3>📈 หุ้นในพอร์ต</h3>
              <span className={`allocation-badge ${totalAllocation === 100 ? 'success' : 'warning'}`}>รวม {totalAllocation}%</span>
            </div>
            <div className="add-stock-flex">
              <input type="text" placeholder="ชื่อหุ้นเช่น SCHD, O" value={newTicker} onChange={e => setNewTicker(e.target.value)} />
              <button onClick={handleAddStock} disabled={loading}>{loading ? '...' : '+'}</button>
            </div>
            <div className="stock-list">
              {portfolio.map((stock, idx) => (
                <div key={idx} className="stock-item-advanced">
                  <div className="stock-top">
                    <strong>{stock.symbol}</strong>
                    <div className="input-with-label"><input type="number" value={stock.allocation} onChange={(e) => updateStock(idx, 'allocation', e.target.value)} /><span>%</span></div>
                    <button className="btn-close" onClick={() => removeStock(idx)}>×</button>
                  </div>
                  <div className="stock-settings">
                    <div className="setting-col"><label>ปันผล (%)</label><input type="number" value={stock.divYield} onChange={(e) => updateStock(idx, 'divYield', e.target.value)} /></div>
                    <div className="setting-col"><label>ราคาโต (%)</label><input type="number" value={stock.growthRate} onChange={(e) => updateStock(idx, 'growthRate', e.target.value)} /></div>
                    <div className="setting-col"><label>ปันผลโต (%)</label><input type="number" value={stock.divGrowth} onChange={(e) => updateStock(idx, 'divGrowth', e.target.value)} /></div>
                    <div className="setting-col"><label>รอบจ่าย</label>
                      <select value={stock.frequency} onChange={(e) => updateStock(idx, 'frequency', e.target.value)}>
                        <option value="12">รายเดือน</option><option value="4">ไตรมาส</option><option value="1">รายปี</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="summary-grid">
            <div className="summary-box main">
              <h4>มูลค่าพอร์ตรวม</h4>
              <h2 className="text-blue">${Number(summary?.finalValue).toLocaleString()}</h2>
              <div className="breakdown">
                <span className="text-invest">เงินลงทุนจริง: ${Number(summary?.totalInvested).toLocaleString()}</span>
                <span className="text-profit">ทบต้นสะสม: ${Number(summary?.compoundedReturns).toLocaleString()}</span>
              </div>
            </div>
            <div className="summary-box">
              <h4>ปันผลรับปีสุดท้าย/ปี</h4>
              <h2 className="text-gold">${Number(summary?.annualDividend).toLocaleString()}</h2>
              <p>Yield เฉลี่ย: {summary?.avgDivYield}%</p>
            </div>
            <div className="summary-box highlight">
              <h4>เป้าหมาย $35,000</h4>
              <h2>{summary?.yearsToTarget ? `ใช้เวลา ${summary.yearsToTarget} ปี` : 'ยังไม่ถึงเป้า'}</h2>
            </div>
          </div>

          <div className="stats-card">
            <h3>📊 สถิติเฉลี่ยย้อนหลัง 10 ปี (Weighted)</h3>
            <div className="stats-grid">
              <div className="stat-item"><span>อัตราปันผลเฉลี่ย:</span> <strong>{summary?.avgDivYield}%</strong></div>
              <div className="stat-item"><span>ปันผลเติบโตเฉลี่ย:</span> <strong>{summary?.avgDivGrowth}%</strong></div>
              <div className="stat-item"><span>ราคาหุ้นโตเฉลี่ย:</span> <strong>{summary?.avgPriceGrowth}%</strong></div>
            </div>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height={380}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Legend />
                <Area type="monotone" dataKey="totalValue" name="พอร์ตรวม" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                <Area type="monotone" dataKey="invested" name="เงินต้น" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}