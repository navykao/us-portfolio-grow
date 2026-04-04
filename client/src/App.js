import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './index.css';

const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_API_KEY;

export default function App() {
  // --- 1. State ทั้งหมด (ห้ามหาย) ---
  const [initialInvestment, setInitialInvestment] = useState(1000);
  const [monthlyContribution, setMonthlyContribution] = useState(200);
  const [annualIncreaseRate, setAnnualIncreaseRate] = useState(5);
  const [years, setYears] = useState(10);
  const [isReinvest, setIsReinvest] = useState(true);
  const [portfolio, setPortfolio] = useState([]);
  const [newTicker, setNewTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState(null);

  const totalAllocation = portfolio.reduce((sum, stock) => sum + parseFloat(stock.allocation || 0), 0);

  // --- 2. ฟังก์ชันจัดการหุ้น ---
  const handleAddStock = async () => {
    if (!newTicker) return;
    if (portfolio.length >= 8) return alert("เพิ่มหุ้นได้สูงสุด 8 ตัวครับ");
    setLoading(true);
    try {
      const symbol = newTicker.toUpperCase();
      const quoteRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
      const quoteData = await quoteRes.json();
      
      const newStock = {
        symbol: symbol,
        price: quoteData.c || 0,
        divYield: 3.5, 
        growthRate: 7.0, // ราคาโต (Cap Gain)
        divGrowth: 5.0, // ปันผลโต
        allocation: portfolio.length === 0 ? 100 : 0,
        frequency: 4 
      };
      setPortfolio([...portfolio, newStock]);
      setNewTicker('');
    } catch (error) { alert("ไม่พบข้อมูลหุ้น"); }
    setLoading(false);
  };

  const updateStock = (index, field, value) => {
    const newPort = [...portfolio];
    newPort[index][field] = value;
    setPortfolio(newPort);
  };

  const removeStock = (index) => setPortfolio(portfolio.filter((_, i) => i !== index));

  // --- 3. ระบบคำนวณ (Monthly Compounding ตามความถี่จริง) ---
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

    // คำนวณสถิติเฉลี่ยแบบถ่วงน้ำหนัก (Weighted Average)
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
        
        // 1. ราคาเติบโตรายเดือน
        monthlyTotalGrowth += stockValue * (parseFloat(stock.growthRate) / 100 / 12);

        // 2. ปันผลเติบโตรายปี
        const yearPassed = Math.floor((m-1) / 12);
        const currentYield = parseFloat(stock.divYield) * Math.pow(1 + (parseFloat(stock.divGrowth)/100), yearPassed);
        
        // 3. จ่ายปันผลตามรอบความถี่
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

      // เก็บข้อมูลรายปี
      if (m % 12 === 0) {
        const yearNum = m / 12;
        const finalValue = currentTotal + accumulatedDividends;
        yearlyData.push({
          year: `ปีที่ ${yearNum}`,
          invested: Math.round(totalInvested),
          totalValue: Math.round(finalValue),
        });
        if (finalValue >= 35000 && yearsToTarget === null) yearsToTarget = yearNum;
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
        <h1>📊 US Portfolio Master</h1>
        <p>วิเคราะห์แผนการลงทุนเชิงลึกและระบบทบต้นอัตโนมัติ</p>
      </header>

      <div className="main-grid">
        <div className="control-panel">
          {/* 1. ระบบ DRIP (ห้ามหาย) */}
          <div className="card drip-card">
            <div className="drip-flex">
              <div>
                <h3>🔄 ปันผลทบต้น (DRIP)</h3>
                <p style={{fontSize: '0.75rem', color: isReinvest ? '#10b981' : '#94a3b8'}}>
                  {isReinvest ? 'เปิด: นำปันผลซื้อหุ้นเพิ่มอัตโนมัติ' : 'ปิด: เก็บปันผลไว้เป็นเงินสด'}
                </p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={isReinvest} onChange={() => setIsReinvest(!isReinvest)} />
                <span className="slider round"></span>
              </label>
            </div>
          </div>

          {/* 2. ตั้งค่าเงินลงทุน (ตรวจสอบช่อง Years แล้ว) */}
          <div className="card">
            <h3>⚙️ ข้อมูลการลงทุน (USD)</h3>
            <div className="input-group"><label>เงินต้นเริ่มต้น</label><input type="number" value={initialInvestment} onChange={e => setInitialInvestment(e.target.value)} /></div>
            <div className="input-group"><label>เติมเงินรายเดือน</label><input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(e.target.value)} /></div>
            <div className="input-group"><label>เพิ่มเงินเติมรายปี (%)</label><input type="number" value={annualIncreaseRate} onChange={e => setAnnualIncreaseRate(e.target.value)} /></div>
            <div className="input-group"><label>ระยะเวลาลงทุน (ปี)</label><input type="number" value={years} onChange={e => setYears(e.target.value)} /></div>
          </div>

          {/* 3. รายการหุ้น (ห้ามหาย) */}
          <div className="card">
            <div className="card-header-flex">
              <h3>📈 หุ้นในพอร์ต</h3>
              <span className={`allocation-badge ${totalAllocation === 100 ? 'success' : 'warning'}`}>รวม {totalAllocation}%</span>
            </div>
            <div className="add-stock-flex">
              <input type="text" placeholder="Ticker" value={newTicker} onChange={e => setNewTicker(e.target.value)} />
              <button onClick={handleAddStock}>+</button>
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
          {/* 4. สรุปผล (แยกยอดเงินต้น/กำไร/เป้าหมาย) */}
          <div className="summary-grid">
            <div className="summary-box main">
              <h4>มูลค่าพอร์ตรวม</h4>
              <h2 className="text-blue">${Number(summary?.finalValue).toLocaleString()}</h2>
              <div className="breakdown">
                <span className="text-invest">เงินลงทุนจริง: ${Number(summary?.totalInvested).toLocaleString()}</span>
                <span className="text-profit">กำไรทบต้น: ${Number(summary?.compoundedReturns).toLocaleString()}</span>
              </div>
            </div>
            <div className="summary-box">
              <h4>เงินปันผล/ปี (ปีสุดท้าย)</h4>
              <h2 className="text-gold">${Number(summary?.annualDividend).toLocaleString()}</h2>
              <p>Yield เฉลี่ย: {summary?.avgDivYield}%</p>
            </div>
            <div className="summary-box highlight">
              <h4>ถึงเป้าหมาย $35,000</h4>
              <h2>{summary?.yearsToTarget ? `ใน ${summary.yearsToTarget} ปี` : 'ยังไม่ถึงเป้า'}</h2>
            </div>
          </div>

          {/* 5. สถิติพอร์ต (ห้ามหาย) */}
          <div className="stats-card">
            <h3>📊 สถิติเฉลี่ยของพอร์ต (Weighted Average)</h3>
            <div className="stats-grid">
              <div className="stat-item"><span>อัตราปันผล/ปี:</span> <strong>{summary?.avgDivYield}%</strong></div>
              <div className="stat-item"><span>ปันผลเติบโต/ปี:</span> <strong>{summary?.avgDivGrowth}%</strong></div>
              <div className="stat-item"><span>ราคาหุ้นเติบโต/ปี:</span> <strong>{summary?.avgPriceGrowth}%</strong></div>
            </div>
          </div>

          {/* 6. กราฟ (ห้ามหาย) */}
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={380}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Legend />
                <Area type="monotone" dataKey="totalValue" name="มูลค่าพอร์ตรวม" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                <Area type="monotone" dataKey="invested" name="ยอดเงินที่ลงทุนจริง" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}