import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './index.css';

// ดึงคีย์ทั้ง 3 ตัวจาก Environment Variables
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

  // --- 🛠️ ฟังก์ชันดึงข้อมูลแบบ Triple-Engine ---
  const fetchSmartData = async (symbol) => {
    setLoading(true);
    let currentPrice = 0;
    let divYield = 3.5;
    let capGainAvg = 7.0;
    let divGrowthAvg = 5.0;

    try {
      // 1. ดึงราคาปัจจุบันจาก Finnhub (เร็วที่สุด)
      const finnhubRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
      const finnhubData = await finnhubRes.json();
      currentPrice = finnhubData.c || 0;

      // 2. ดึงประวัติราคาย้อนหลัง 10 ปีจาก Polygon (แม่นยำเรื่อง Capital Gain)
      const tenYearsAgo = new Date(new Date().getFullYear() - 10, 0, 1).toISOString().split('T')[0];
      const polyPriceRes = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${tenYearsAgo}/${new Date().toISOString().split('T')[0]}?adjusted=true&sort=asc&limit=1&apiKey=${POLYGON_KEY}`);
      const polyPriceData = await polyPriceRes.json();

      if (polyPriceData.results && polyPriceData.results.length > 0) {
        const oldPrice = polyPriceData.results[0].c;
        capGainAvg = (Math.pow(currentPrice / oldPrice, 1 / 10) - 1) * 100;
      }

      // 3. ดึงประวัติปันผลจาก EODHD (ละเอียดที่สุดเรื่องปันผล)
      // หมายเหตุ: หาก EODHD Key ของคุณเป็นแบบฟรี อาจจะใช้ Fallback ไป Polygon หรือ Finnhub แทน
      const eodRes = await fetch(`https://eodhd.com/api/div/${symbol}.US?api_token=${EODHD_KEY}&fmt=json&from=${tenYearsAgo}`);
      let eodData = await eodRes.json();

      if (eodData && eodData.length > 0) {
        // คำนวณ Dividend Yield ปัจจุบัน
        const annualDiv = eodData.slice(0, 4).reduce((sum, d) => sum + parseFloat(d.value), 0);
        divYield = (annualDiv / currentPrice) * 100;

        // คำนวณ Dividend Growth 10 ปี
        const recentDiv = parseFloat(eodData[0].value);
        const oldDiv = parseFloat(eodData[eodData.length - 1].value);
        divGrowthAvg = (Math.pow(recentDiv / oldDiv, 1 / 10) - 1) * 100;
      }

      const newStock = {
        symbol: symbol,
        price: currentPrice,
        divYield: divYield.toFixed(2),
        growthRate: capGainAvg.toFixed(2),
        divGrowth: divGrowthAvg.toFixed(2),
        allocation: portfolio.length === 0 ? 100 : 0,
        frequency: 4 
      };

      setPortfolio([...portfolio, newStock]);
      setNewTicker('');
    } catch (error) {
      console.error("API Error:", error);
      alert("ไม่สามารถดึงข้อมูลหุ้นได้ครบถ้วน ระบบจะใช้ค่าเฉลี่ยมาตรฐานแทน");
      // Fallback: เพิ่มหุ้นแบบ Manual ถ้า API ตัวใดตัวหนึ่งล่ม
      setPortfolio([...portfolio, {
        symbol: symbol, price: 100, divYield: 3.0, growthRate: 7.0, divGrowth: 5.0, allocation: 0, frequency: 4
      }]);
    }
    setLoading(false);
  };

  const handleAddStock = () => {
    if (!newTicker) return;
    if (portfolio.length >= 8) return alert("จำกัดหุ้น 8 ตัวครับ");
    fetchSmartData(newTicker.toUpperCase());
  };

  // --- 🔄 ทุกฟังก์ชันเดิม ห้ามลบ ห้ามหาย ---
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
    let currentTotal = parseFloat(initialInvestment);
    let currentMonthlyDeposit = parseFloat(monthlyContribution);
    let totalInvested = parseFloat(initialInvestment);
    let accumulatedDividends = 0;
    let yearlyData = [];
    let yearsToTarget = null;

    let avgDivYield = 0, avgPriceGrowth = 0, avgDivGrowth = 0;
    if (portfolio.length > 0 && totalAllocation > 0) {
      portfolio.forEach(s => {
        const w = (parseFloat(s.allocation) / totalAllocation);
        avgDivYield += parseFloat(s.divYield) * w;
        avgPriceGrowth += parseFloat(s.growthRate) * w;
        avgDivGrowth += parseFloat(s.divGrowth) * w;
      });
    }

    const totalMonths = parseInt(years) * 12;

    for (let m = 1; m <= totalMonths; m++) {
      currentTotal += currentMonthlyDeposit;
      totalInvested += currentMonthlyDeposit;

      let monthlyTotalDiv = 0;
      let monthlyTotalGrowth = 0;

      portfolio.forEach(stock => {
        const stockWeight = parseFloat(stock.allocation) / 100;
        const stockValue = currentTotal * stockWeight;
        monthlyTotalGrowth += stockValue * (parseFloat(stock.growthRate) / 100 / 12);
        const yearPassed = Math.floor((m-1) / 12);
        const currentYield = parseFloat(stock.divYield) * Math.pow(1 + (parseFloat(stock.divGrowth)/100), yearPassed);
        const payCycle = 12 / parseInt(stock.frequency);
        if (m % payCycle === 0) {
          monthlyTotalDiv += stockValue * (currentYield / 100 / parseInt(stock.frequency));
        }
      });

      if (isReinvest) {
        currentTotal += (monthlyTotalDiv + monthlyTotalGrowth);
      } else {
        currentTotal += monthlyTotalGrowth;
        accumulatedDividends += monthlyTotalDiv;
      }

      if (m % 12 === 0) {
        const yearNum = m / 12;
        const finalVal = currentTotal + accumulatedDividends;
        yearlyData.push({
          year: `ปีที่ ${yearNum}`,
          invested: Math.round(totalInvested),
          totalValue: Math.round(finalVal)
        });
        if (finalVal >= 35000 && yearsToTarget === null) yearsToTarget = yearNum;
        currentMonthlyDeposit *= (1 + annualIncreaseRate / 100);
      }
    }

    setChartData(yearlyData);
    const finalVal = currentTotal + accumulatedDividends;
    setSummary({
      finalValue: finalVal.toFixed(2),
      totalInvested: totalInvested.toFixed(2),
      compoundedReturns: (finalVal - totalInvested).toFixed(2),
      avgDivYield: avgDivYield.toFixed(2),
      avgPriceGrowth: avgPriceGrowth.toFixed(2),
      avgDivGrowth: avgDivGrowth.toFixed(2),
      annualDividend: (currentTotal * (avgDivYield / 100)).toFixed(2),
      yearsToTarget
    });
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>🛡️ Triple-Engine Portfolio Simulator</h1>
        <p>ขับเคลื่อนด้วย 3 API ชั้นนำเพื่อความแม่นยำระดับสูงสุด</p>
      </header>

      <div className="main-grid">
        <div className="control-panel">
          {/* DRIP Toggle */}
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

          {/* Investment Settings - YEARS MUST STAY HERE */}
          <div className="card">
            <h3>⚙️ ข้อมูลการลงทุน (USD)</h3>
            <div className="input-group"><label>เงินต้นเริ่มต้น</label><input type="number" value={initialInvestment} onChange={e => setInitialInvestment(e.target.value)} /></div>
            <div className="input-group"><label>เติมเงินรายเดือน</label><input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(e.target.value)} /></div>
            <div className="input-group"><label>เพิ่มเงินเติม/ปี (%)</label><input type="number" value={annualIncreaseRate} onChange={e => setAnnualIncreaseRate(e.target.value)} /></div>
            <div className="input-group"><label>ระยะเวลาลงทุน (ปี)</label><input type="number" value={years} onChange={e => setYears(e.target.value)} /></div>
          </div>

          {/* Portfolio List */}
          <div className="card">
            <div className="card-header-flex">
              <h3>📈 หุ้นในพอร์ต</h3>
              <span className={`allocation-badge ${totalAllocation === 100 ? 'success' : 'warning'}`}>รวม {totalAllocation}%</span>
            </div>
            <div className="add-stock-flex">
              <input type="text" placeholder="Ticker (เช่น O, SCHD)" value={newTicker} onChange={e => setNewTicker(e.target.value)} />
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
                    <div className="setting-col"><label>ราคาโต/ปี (%)</label><input type="number" value={stock.growthRate} onChange={(e) => updateStock(idx, 'growthRate', e.target.value)} /></div>
                    <div className="setting-col"><label>ปันผลโต/ปี (%)</label><input type="number" value={stock.divGrowth} onChange={(e) => updateStock(idx, 'divGrowth', e.target.value)} /></div>
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
          {/* Summary */}
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
              <h4>เงินปันผล/ปี</h4>
              <h2 className="text-gold">${Number(summary?.annualDividend).toLocaleString()}</h2>
              <p>Yield เฉลี่ย: {summary?.avgDivYield}%</p>
            </div>
            <div className="summary-box highlight">
              <h4>ถึงเป้าหมาย $35,000</h4>
              <h2>{summary?.yearsToTarget ? `ใน ${summary.yearsToTarget} ปี` : 'ยังไม่ถึงเป้า'}</h2>
            </div>
          </div>

          {/* Stats Card */}
          <div className="stats-card">
            <h3>📊 สถิติเฉลี่ยจาก 3 API (10 ปี)</h3>
            <div className="stats-grid">
              <div className="stat-item"><span>อัตราปันผลเฉลี่ย:</span> <strong>{summary?.avgDivYield}%</strong></div>
              <div className="stat-item"><span>ปันผลเติบโตเฉลี่ย:</span> <strong>{summary?.avgDivGrowth}%</strong></div>
              <div className="stat-item"><span>ราคาหุ้นโตเฉลี่ย:</span> <strong>{summary?.avgPriceGrowth}%</strong></div>
            </div>
          </div>

          {/* Chart */}
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