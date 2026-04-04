import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './index.css';

export default function App() {

  // ================= STATE =================
  const [initialInvestment, setInitialInvestment] = useState(1000);
  const [monthlyContribution, setMonthlyContribution] = useState(200);
  const [annualIncreaseRate, setAnnualIncreaseRate] = useState(5);
  const [years, setYears] = useState(15);
  const [isReinvest, setIsReinvest] = useState(true);

  const [portfolio, setPortfolio] = useState([]);
  const [newTicker, setNewTicker] = useState('');

  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState({});

  // ================= FORMAT =================
  const formatMoney = (num) =>
    Number(num || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  // ================= STOCK =================
  const handleAddStock = () => {
    if (!newTicker) return;
    if (portfolio.length >= 8) return alert("เพิ่มได้สูงสุด 8 ตัว");

    const newStock = {
      symbol: newTicker.toUpperCase(),
      allocation: portfolio.length === 0 ? 100 : 0
    };

    setPortfolio([...portfolio, newStock]);
    setNewTicker('');
  };

  const updateStock = (i, field, val) => {
    const newPort = [...portfolio];
    newPort[i][field] = val;
    setPortfolio(newPort);
  };

  const removeStock = (i) => {
    setPortfolio(portfolio.filter((_, idx) => idx !== i));
  };

  // ================= CALCULATION =================
  useEffect(() => {
    let total = Number(initialInvestment);
    let invest = Number(initialInvestment);
    let monthly = Number(monthlyContribution);

    let yearlyData = [];
    let lastDiv = 0;

    const totalMonths = years * 12;

    for (let m = 1; m <= totalMonths; m++) {
      total += monthly;
      invest += monthly;

      let growth = total * 0.07 / 12;
      let div = total * 0.03 / 12;

      if (isReinvest) total += (growth + div);
      else total += growth;

      if (m % 12 === 0) {
        yearlyData.push({
          year: `ปี ${m / 12}`,
          invested: Math.round(invest),
          totalValue: Math.round(total)
        });

        lastDiv += div * 12;
      }
    }

    setChartData(yearlyData);

    setSummary({
      finalValue: total,
      totalInvested: invest,
      compoundedReturns: total - invest,
      annualDividend: lastDiv
    });

  }, [
    initialInvestment,
    monthlyContribution,
    annualIncreaseRate,
    years,
    portfolio,
    isReinvest
  ]);

  // ================= UI =================
  return (
    <div className="app-container">

     <h1>📊 US Portfolio Master Pro</h1>

      <div className="main-grid">

        {/* LEFT */}
        <div className="card">

          <h3>ตั้งค่า</h3>

          <input type="number" value={initialInvestment} onChange={e => setInitialInvestment(e.target.value)} placeholder="เงินเริ่มต้น" />
          <input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(e.target.value)} placeholder="รายเดือน" />
          <input type="number" value={annualIncreaseRate} onChange={e => setAnnualIncreaseRate(e.target.value)} placeholder="% เพิ่มต่อปี" />
          <input type="number" value={years} onChange={e => setYears(e.target.value)} placeholder="จำนวนปี" />

          <h3>เพิ่มหุ้น</h3>

          <div className="add-stock-flex">
            <input value={newTicker} onChange={e => setNewTicker(e.target.value)} placeholder="เช่น SCHD" />
            <button onClick={handleAddStock}>➕</button>
          </div>

          {portfolio.map((s, i) => (
            <div key={i} className="stock-item">
              <b>{s.symbol}</b>
              <input value={s.allocation} onChange={e => updateStock(i, 'allocation', e.target.value)} />
              <button onClick={() => removeStock(i)}>x</button>
            </div>
          ))}

        </div>

        {/* RIGHT */}
        <div>

          <div className="summary-grid">

            <div className="summary-box">
              <h2>${formatMoney(summary.finalValue)}</h2>
              <p>มูลค่ารวม</p>
            </div>

            <div className="summary-box">
              <h2>${formatMoney(summary.totalInvested)}</h2>
              <p>เงินลงทุน</p>
            </div>

            <div className="summary-box">
              <h2>${formatMoney(summary.compoundedReturns)}</h2>
              <p>กำไร</p>
            </div>

            <div className="summary-box">
              <h2>${formatMoney(summary.annualDividend)}</h2>
              <p>ปันผล/ปี</p>
            </div>

          </div>

          <div className="card">

            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="totalValue" stroke="#3b82f6" fill="#3b82f6" />
                <Area type="monotone" dataKey="invested" stroke="#10b981" fill="#10b981" />
              </AreaChart>
            </ResponsiveContainer>

          </div>

        </div>

      </div>

    </div>
  );
}