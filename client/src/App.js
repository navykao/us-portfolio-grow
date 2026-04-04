import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './index.css';

const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_API_KEY;

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
        allocation: portfolio.length === 0 ? 100 : 0,
        frequency: 4 // ค่าเริ่มต้นเป็นรายไตรมาส (Quarterly)
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

    const totalMonths = years * 12;

    for (let m = 1; m <= totalMonths; m++) {
      // 1. เติมเงินรายเดือนตอนต้นเดือน
      currentTotal += currentMonthlyDeposit;
      totalInvested += currentMonthlyDeposit;

      let monthlyTotalDiv = 0;
      let monthlyTotalGrowth = 0;

      // 2. คำนวณรายหุ้นตามความถี่จริง
      portfolio.forEach(stock => {
        const stockWeight = parseFloat(stock.allocation) / 100;
        const stockValue = currentTotal * stockWeight;
        
        // คำนวณการเติบโตของราคา (หาร 12 เดือน)
        monthlyTotalGrowth += stockValue * (parseFloat(stock.growthRate) / 100 / 12);

        // คำนวณปันผลเฉพาะเดือนที่มีการจ่าย (m % รอบเดือน == 0)
        // รอบเดือน: รายเดือน=1, ไตรมาส=3, ครึ่งปี=6, รายปี=12
        const payCycle = 12 / parseInt(stock.frequency);
        if (m % payCycle === 0) {
          monthlyTotalDiv += stockValue * (parseFloat(stock.divYield) / 100 / parseInt(stock.frequency));
        }
      });

      // 3. ทบต้นหรือเก็บเงินสด
      if (isReinvest) {
        currentTotal += (monthlyTotalDiv + monthlyTotalGrowth);
      } else {
        currentTotal += monthlyTotalGrowth;
        accumulatedDividends += monthlyTotalDiv;
      }

      // 4. สรุปผลรายปี
      if (m % 12 === 0) {
        const yearNum = m / 12;
        const finalYearlyValue = currentTotal + accumulatedDividends;
        yearlyData.push({
          year: `ปีที่ ${yearNum}`,
          invested: Math.round(totalInvested),
          totalValue: Math.round(finalYearlyValue),
        });

        if (finalYearlyValue >= 35000 && yearsToTarget === null) yearsToTarget = yearNum;
        currentMonthlyDeposit *= (1 + annualIncreaseRate / 100);
      }
    }

    setChartData(yearlyData);
    setSummary({
      finalValue: (currentTotal + accumulatedDividends).toFixed(2),
      totalInvested: totalInvested.toFixed(2),
      totalReturns: (currentTotal + accumulatedDividends - totalInvested).toFixed(2),
      yearsToTarget
    });
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>📊 Real-Frequency Portfolio Simulator</h1>
        <p>คำนวณปันผลทบต้นตามรอบการจ่ายจริงของหุ้นแต่ละตัว</p>
      </header>

      <div className="main-grid">
        <div className="control-panel">
          <div className="card drip-card">
            <div className="drip-flex">
              <div>
                <h3>🔄 ระบบปันผลทบต้น (DRIP)</h3>
                <p style={{fontSize: '0.75rem', color: isReinvest ? '#10b981' : '#94a3b8'}}>
                  {isReinvest ? 'เปิด: ทบต้นทันทีในเดือนที่จ่าย' : 'ปิด: แยกปันผลเป็นเงินสด'}
                </p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={isReinvest} onChange={() => setIsReinvest(!isReinvest)} />
                <span className="slider round"></span>
              </label>
            </div>
          </div>

          <div className="card">
            <h3>📈 จัดการหุ้นและรอบปันผล</h3>
            <div className="add-stock-flex">
              <input type="text" placeholder="Ticker เช่น O, AAPL" value={newTicker} onChange={e => setNewTicker(e.target.value)} />
              <button onClick={handleAddStock} disabled={loading}>+</button>
            </div>
            <div className="stock-list">
              {portfolio.map((stock, idx) => (
                <div key={idx} className="stock-item-advanced">
                  <div className="stock-top">
                    <strong>{stock.symbol}</strong>
                    <div className="input-with-label">
                      <input type="number" value={stock.allocation} onChange={(e) => updateStock(idx, 'allocation', e.target.value)} />
                      <span>%</span>
                    </div>
                    <button className="btn-close" onClick={() => removeStock(idx)}>×</button>
                  </div>
                  <div className="stock-settings">
                    <div className="setting-col">
                      <label>ปันผล (%)</label>
                      <input type="number" value={stock.divYield} onChange={(e) => updateStock(idx, 'divYield', e.target.value)} />
                    </div>
                    <div className="setting-col">
                      <label>รอบจ่ายปันผล</label>
                      <select value={stock.frequency} onChange={(e) => updateStock(idx, 'frequency', e.target.value)}>
                        <option value="12">ทุกเดือน</option>
                        <option value="4">ทุกไตรมาส</option>
                        <option value="2">ทุก 6 เดือน</option>
                        <option value="1">รายปี</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className={`alloc-bar ${totalAllocation === 100 ? 'ok' : 'error'}`}>
              สัดส่วนพอร์ตรวม: {totalAllocation}%
            </div>
          </div>

          <div className="card">
            <h3>⚙️ ตั้งค่าเงินลงทุน</h3>
            <div className="input-group"><label>เงินต้นเริ่มต้น (USD)</label><input type="number" value={initialInvestment} onChange={e => setInitialInvestment(e.target.value)} /></div>
            <div className="input-group"><label>เติมเงินรายเดือน (USD)</label><input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(e.target.value)} /></div>
            <div className="input-group"><label>เพิ่มเงินเติมรายปี (%)</label><input type="number" value={annualIncreaseRate} onChange={e => setAnnualIncreaseRate(e.target.value)} /></div>
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="summary-grid">
            <div className="summary-box">
              <h4>มูลค่าพอร์ตรวม</h4>
              <h2 className="text-blue">${Number(summary?.finalValue).toLocaleString()}</h2>
              <p className="text-green">กำไรสะสม: +${Number(summary?.totalReturns).toLocaleString()}</p>
            </div>
            <div className="summary-box highlight">
              <h4>อิสรภาพทางการเงิน</h4>
              <h2>{summary?.yearsToTarget ? `ปีที่ ${summary.yearsToTarget}` : 'เกิน 40 ปี'}</h2>
              <p>ที่มูลค่า $35,000</p>
            </div>
          </div>

          <div className="chart-container">
            <h3>📊 พลังของดอกเบี้ยทบต้น (Compound Interest)</h3>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="totalValue" name="มูลค่าพอร์ตรวม" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                <Area type="monotone" dataKey="invested" name="เงินต้นรวม" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}