import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './index.css';

const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_API_KEY;

export default function App() {
  const [initialInvestment, setInitialInvestment] = useState(1000);
  const [monthlyContribution, setMonthlyContribution] = useState(200);
  const [annualIncreaseRate, setAnnualIncreaseRate] = useState(5);
  const [years, setYears] = useState(15);
  const [isReinvest, setIsReinvest] = useState(true); // 👈 เพิ่มสถานะเปิด/ปิด DRIP
  const [portfolio, setPortfolio] = useState([]);
  const [newTicker, setNewTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState(null);

  const totalAllocation = portfolio.reduce((sum, stock) => sum + parseFloat(stock.allocation || 0), 0);

  const handleAddStock = async () => {
    if (!newTicker) return;
    if (portfolio.length >= 8) return alert("สูงสุด 8 ตัวครับ");
    setLoading(true);
    try {
      const symbol = newTicker.toUpperCase();
      const quoteRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
      const quoteData = await quoteRes.json();
      const newStock = {
        symbol: symbol,
        price: quoteData.c || 0,
        divYield: (Math.random() * 3 + 1).toFixed(2), 
        growthRate: (Math.random() * 8 + 4).toFixed(2),
        allocation: portfolio.length === 0 ? 100 : 0
      };
      setPortfolio([...portfolio, newStock]);
      setNewTicker('');
    } catch (error) { alert("ไม่พบข้อมูลหุ้น"); }
    setLoading(false);
  };

  const updateAllocation = (index, value) => {
    const newPort = [...portfolio];
    newPort[index].allocation = Number(value);
    setPortfolio(newPort);
  };

  const removeStock = (index) => setPortfolio(portfolio.filter((_, i) => i !== index));

  useEffect(() => {
    calculateReturns();
  }, [initialInvestment, monthlyContribution, annualIncreaseRate, years, portfolio, isReinvest]);

  const calculateReturns = () => {
    let avgDivYield = 0, avgGrowth = 0;
    if (portfolio.length > 0 && totalAllocation > 0) {
      portfolio.forEach(stock => {
        const weight = (stock.allocation / totalAllocation); 
        avgDivYield += parseFloat(stock.divYield) * weight;
        avgGrowth += parseFloat(stock.growthRate) * weight;
      });
    } else { avgDivYield = 2.5; avgGrowth = 7.0; }

    let currentTotal = parseFloat(initialInvestment);
    let currentMonthly = parseFloat(monthlyContribution);
    let totalInvested = parseFloat(initialInvestment);
    let accumulatedDividends = 0; // ปันผลสะสม (กรณีไม่ลงทุนต่อ)
    let yearlyData = [];
    let yearsToTarget = null;

    for (let year = 1; year <= years; year++) {
      let yearInvested = currentMonthly * 12;
      totalInvested += yearInvested;
      
      let dividendEarned = currentTotal * (avgDivYield / 100);
      let capitalGains = currentTotal * (avgGrowth / 100);
      
      // --- ระบบคำนวณปันผลทบต้น ---
      if (isReinvest) {
        currentTotal = currentTotal + yearInvested + dividendEarned + capitalGains;
      } else {
        currentTotal = currentTotal + yearInvested + capitalGains; // เติบโตแค่ราคาและเงินเติม
        accumulatedDividends += dividendEarned; // แยกปันผลออกไปเก็บไว้
      }

      const displayTotal = currentTotal + (!isReinvest ? accumulatedDividends : 0);

      yearlyData.push({
        year: `ปีที่ ${year}`,
        invested: Number(totalInvested.toFixed(2)),
        totalValue: Number(displayTotal.toFixed(2)),
        dividendCash: Number(accumulatedDividends.toFixed(2))
      });

      if (displayTotal >= 35000 && yearsToTarget === null) yearsToTarget = year;
      currentMonthly *= (1 + annualIncreaseRate / 100);
    }

    setChartData(yearlyData);
    setSummary({
      avgDivYield: avgDivYield.toFixed(2),
      avgGrowth: avgGrowth.toFixed(2),
      finalValue: (currentTotal + accumulatedDividends).toFixed(2),
      totalInvested: totalInvested.toFixed(2),
      totalReturns: (currentTotal + accumulatedDividends - totalInvested).toFixed(2),
      annualDividend: ((currentTotal) * (avgDivYield / 100)).toFixed(2),
      yearsToTarget
    });
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>📊 US Portfolio Simulator</h1>
        <p>วิเคราะห์แผนการลงทุนและระบบปันผลทบต้น (DRIP)</p>
      </header>

      <div className="main-grid">
        <div className="control-panel">
          {/* DRIP Toggle Switch */}
          <div className="card drip-card">
            <div className="drip-flex">
              <div>
                <h3 style={{marginBottom: '5px'}}>🔄 ระบบปันผลทบต้น (DRIP)</h3>
                <p style={{fontSize: '0.75rem', color: '#94a3b8'}}>
                  {isReinvest ? 'เปิด: นำปันผลไปซื้อหุ้นเพิ่มทันที' : 'ปิด: เก็บปันผลไว้เป็นเงินสด'}
                </p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={isReinvest} onChange={() => setIsReinvest(!isReinvest)} />
                <span className="slider round"></span>
              </label>
            </div>
          </div>

          <div className="card">
            <h3>⚙️ ตั้งค่าเงินลงทุน</h3>
            <div className="input-group">
              <label>เงินต้นเริ่มต้น (USD)</label>
              <input type="number" value={initialInvestment} onChange={e => setInitialInvestment(e.target.value)} />
            </div>
            <div className="input-group">
              <label>ลงทุนเพิ่มรายเดือน (USD)</label>
              <input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(e.target.value)} />
            </div>
            <div className="input-group">
              <label>เพิ่มเงินลงทุนรายปี (%)</label>
              <input type="number" value={annualIncreaseRate} onChange={e => setAnnualIncreaseRate(e.target.value)} />
            </div>
            <div className="input-group">
              <label>ระยะเวลาลงทุน (ปี)</label>
              <input type="number" value={years} onChange={e => setYears(e.target.value)} />
            </div>
          </div>

          <div className="card">
            <div className="card-header-flex">
              <h3>📈 หุ้นในพอร์ต</h3>
              <span className={`allocation-badge ${totalAllocation !== 100 ? 'warning' : 'success'}`}>
                {totalAllocation}%
              </span>
            </div>
            <div className="add-stock-flex">
              <input type="text" placeholder="Ticker เช่น SCHD" value={newTicker} onChange={e => setNewTicker(e.target.value)} />
              <button onClick={handleAddStock} disabled={loading}>+</button>
            </div>
            <div className="stock-list">
              {portfolio.map((stock, idx) => (
                <div key={idx} className="stock-item-expanded">
                  <div className="stock-main-row">
                    <strong>{stock.symbol}</strong>
                    <input type="number" className="alloc-input" value={stock.allocation} onChange={(e) => updateAllocation(idx, e.target.value)} />
                    <span className="percent-unit">%</span>
                    <button className="btn-remove-small" onClick={() => removeStock(idx)}>×</button>
                  </div>
                  <div className="stock-sub-row">
                    <span>ปันผล: {stock.divYield}%</span>
                    <span>เติบโต: {stock.growthRate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="summary-grid">
            <div className="summary-box">
              <h4>มูลค่าพอร์ตรวม</h4>
              <h2 className="text-blue">${Number(summary?.finalValue).toLocaleString()}</h2>
              <p className="text-green">กำไร: +${Number(summary?.totalReturns).toLocaleString()}</p>
            </div>
            <div className="summary-box">
              <h4>ปันผลรับต่อปี</h4>
              <h2 className="text-gold">${Number(summary?.annualDividend).toLocaleString()}</h2>
              <p>เฉลี่ย: {summary?.avgDivYield}% / ปี</p>
            </div>
            <div className="summary-box highlight">
              <h4>เป้าหมาย 1 ล้านบาท</h4>
              <h2>{summary?.yearsToTarget ? `${summary.yearsToTarget} ปี` : 'เกินกำหนด'}</h2>
            </div>
          </div>

          <div className="chart-container">
            <h3 style={{marginBottom: '15px'}}>📊 กราฟการเติบโต {isReinvest ? '(แบบทบต้น)' : '(แบบไม่ทบต้น)'}</h3>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Legend />
                <Area type="monotone" dataKey="totalValue" name="มูลค่ารวมพอร์ต" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                <Area type="monotone" dataKey="invested" name="เงินต้นที่ลงไป" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}