import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './index.css';

// ดึงค่า API Keys จากไฟล์ .env
const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_API_KEY;

export default function App() {
  // 1. ตัวแปรสำหรับฟอร์มกรอกข้อมูล (USD)
  const [initialInvestment, setInitialInvestment] = useState(1000);
  const [monthlyContribution, setMonthlyContribution] = useState(200);
  const [annualIncreaseRate, setAnnualIncreaseRate] = useState(5);
  const [years, setYears] = useState(15);

  // 2. ตัวแปรจัดการพอร์ตหุ้น (สูงสุด 8 ตัว)
  const [portfolio, setPortfolio] = useState([]);
  const [newTicker, setNewTicker] = useState('');
  const [loading, setLoading] = useState(false);

  // 3. ตัวแปรสำหรับผลลัพธ์และกราฟ
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState(null);

  // --- ฟังก์ชัน API ดึงข้อมูลหุ้น ---
  const handleAddStock = async () => {
    if (!newTicker) return;
    if (portfolio.length >= 8) {
      alert("เพิ่มหุ้นได้สูงสุด 8 ตัวเท่านั้นครับ");
      return;
    }
    
    setLoading(true);
    const symbol = newTicker.toUpperCase();
    
    try {
      // ใช้ Finnhub API เพื่อดึงราคาปัจจุบัน (Quote)
      const quoteRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
      const quoteData = await quoteRes.json();

      // สมมติค่าปันผลและการเติบโต (เนื่องจาก API ฟรีบางตัวไม่ได้ให้ประวัติปันผลระยะยาวใน Endpoint เดียว)
      // ในระบบจริงสามารถเชื่อม EODHD หรือ Polygon เพิ่มเติมในจุดนี้ได้
      const newStock = {
        symbol: symbol,
        price: quoteData.c || 0, // Current price
        divYield: (Math.random() * 3 + 1).toFixed(2), // Mock yield 1-4%
        growthRate: (Math.random() * 8 + 4).toFixed(2), // Mock growth 4-12%
        allocation: 100 / (portfolio.length + 1) // เกลี่ยสัดส่วนอัตโนมัติ
      };

      // อัปเดตสัดส่วนหุ้นเดิมให้สมดุล
      const updatedPortfolio = portfolio.map(stock => ({
        ...stock,
        allocation: 100 / (portfolio.length + 1)
      }));

      setPortfolio([...updatedPortfolio, newStock]);
      setNewTicker('');
    } catch (error) {
      alert("ไม่พบข้อมูลหุ้น หรือ API มีปัญหา");
    }
    setLoading(false);
  };

  const removeStock = (indexToRemove) => {
    const newPort = portfolio.filter((_, index) => index !== indexToRemove);
    // อัปเดตสัดส่วนใหม่
    const updatedPort = newPort.map(stock => ({
      ...stock,
      allocation: 100 / newPort.length
    }));
    setPortfolio(updatedPort);
  };

  // --- ฟังก์ชันคำนวณผลตอบแทน ---
  useEffect(() => {
    calculateReturns();
  }, [initialInvestment, monthlyContribution, annualIncreaseRate, years, portfolio]);

  const calculateReturns = () => {
    // หาค่าเฉลี่ยของพอร์ต
    let avgDivYield = 0;
    let avgGrowth = 0;

    if (portfolio.length > 0) {
      portfolio.forEach(stock => {
        const weight = stock.allocation / 100;
        avgDivYield += parseFloat(stock.divYield) * weight;
        avgGrowth += parseFloat(stock.growthRate) * weight;
      });
    } else {
      // ค่าเริ่มต้นถ้ายังไม่เพิ่มหุ้น
      avgDivYield = 2.5; 
      avgGrowth = 7.0;
    }

    let currentTotal = parseFloat(initialInvestment);
    let currentMonthly = parseFloat(monthlyContribution);
    let totalInvested = parseFloat(initialInvestment);
    
    let yearlyData = [];
    let yearsTo1MillionTHB = null; // 35,000 USD
    const targetUSD = 35000;

    for (let year = 1; year <= years; year++) {
      let yearInvested = currentMonthly * 12;
      totalInvested += yearInvested;

      // คำนวณการเติบโตของเงินต้นและปันผล (ทบต้น)
      let dividendEarned = currentTotal * (avgDivYield / 100);
      let capitalGains = currentTotal * (avgGrowth / 100);
      
      currentTotal = currentTotal + yearInvested + dividendEarned + capitalGains;

      yearlyData.push({
        year: `ปีที่ ${year}`,
        invested: parseFloat(totalInvested.toFixed(2)),
        returns: parseFloat((currentTotal - totalInvested).toFixed(2)),
        totalValue: parseFloat(currentTotal.toFixed(2))
      });

      // เช็คว่าถึง 35,000 USD หรือยัง
      if (currentTotal >= targetUSD && yearsTo1MillionTHB === null) {
        yearsTo1MillionTHB = year;
      }

      // เพิ่มเงินลงทุนรายเดือนในปีถัดไป
      currentMonthly = currentMonthly * (1 + parseFloat(annualIncreaseRate) / 100);
    }

    setChartData(yearlyData);
    setSummary({
      avgDivYield: avgDivYield.toFixed(2),
      avgGrowth: avgGrowth.toFixed(2),
      finalValue: currentTotal.toFixed(2),
      totalInvested: totalInvested.toFixed(2),
      totalReturns: (currentTotal - totalInvested).toFixed(2),
      annualDividend: (currentTotal * (avgDivYield / 100)).toFixed(2),
      yearsToTarget: yearsTo1MillionTHB
    });
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>📊 US Stock Portfolio Calculator</h1>
        <p>วิเคราะห์ผลตอบแทน ดอกเบี้ยทบต้น และเงินปันผล (USD)</p>
      </header>

      <div className="main-grid">
        {/* ส่วนที่ 1: แผงควบคุมและกรอกข้อมูล */}
        <div className="control-panel">
          <div className="card">
            <h3>⚙️ ตั้งค่าการลงทุน</h3>
            <div className="input-group">
              <label>เงินทุนเริ่มต้น (USD)</label>
              <input type="number" value={initialInvestment} onChange={e => setInitialInvestment(e.target.value)} />
            </div>
            <div className="input-group">
              <label>ลงทุนรายเดือน (USD)</label>
              <input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(e.target.value)} />
            </div>
            <div className="input-group">
              <label>เพิ่มเงินลงทุนรายปี (%)</label>
              <input type="number" value={annualIncreaseRate} onChange={e => setAnnualIncreaseRate(e.target.value)} />
            </div>
            <div className="input-group">
              <label>ระยะเวลา (ปี) [1-40]</label>
              <input type="number" min="1" max="40" value={years} onChange={e => setYears(e.target.value)} />
            </div>
          </div>

          {/* ส่วนที่ 2: จัดการรายชื่อหุ้น */}
          <div className="card">
            <h3>📈 หุ้นในพอร์ต ({portfolio.length}/8)</h3>
            <div className="add-stock-flex">
              <input 
                type="text" 
                placeholder="ชื่อย่อหุ้น (เช่น AAPL)" 
                value={newTicker} 
                onChange={e => setNewTicker(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleAddStock()}
              />
              <button onClick={handleAddStock} disabled={loading || portfolio.length >= 8}>
                {loading ? '...' : '+ เพิ่ม'}
              </button>
            </div>
            
            <div className="stock-list">
              {portfolio.map((stock, idx) => (
                <div key={idx} className="stock-item">
                  <div className="stock-info">
                    <strong>{stock.symbol}</strong>
                    <span className="stock-price">${stock.price.toFixed(2)}</span>
                  </div>
                  <div className="stock-stats">
                    <span>ปันผล: {stock.divYield}%</span>
                    <span>เติบโต: {stock.growthRate}%</span>
                  </div>
                  <button className="btn-remove" onClick={() => removeStock(idx)}>ลบ</button>
                </div>
              ))}
              {portfolio.length === 0 && <p className="text-muted" style={{fontSize: '0.8rem', textAlign: 'center'}}>ยังไม่มีหุ้น ระบบใช้ค่าเฉลี่ยตลาดคำนวณ</p>}
            </div>
          </div>
        </div>

        {/* ส่วนที่ 3: สรุปผลและกราฟ */}
        <div className="dashboard-panel">
          <div className="summary-grid">
            <div className="summary-box">
              <h4>มูลค่าพอร์ตรวม (ปีที่ {years})</h4>
              <h2 className="text-blue">${summary ? parseFloat(summary.finalValue).toLocaleString() : 0}</h2>
              <p>เงินต้น: ${summary ? parseFloat(summary.totalInvested).toLocaleString() : 0}</p>
              <p className="text-green">ผลกำไร: +${summary ? parseFloat(summary.totalReturns).toLocaleString() : 0}</p>
            </div>
            <div className="summary-box">
              <h4>ข้อมูลปันผลและการเติบโต</h4>
              <p>อัตราปันผลเฉลี่ย: <strong>{summary?.avgDivYield}% / ปี</strong></p>
              <p>ราคาเติบโตเฉลี่ย: <strong>{summary?.avgGrowth}% / ปี</strong></p>
              <p>ปันผลปีสุดท้าย: <strong className="text-gold">${summary ? parseFloat(summary.annualDividend).toLocaleString() : 0}</strong></p>
            </div>
            <div className="summary-box highlight">
              <h4>เป้าหมาย 1 ล้านบาท ($35,000)</h4>
              <h2>{summary?.yearsToTarget ? `ใช้เวลา ${summary.yearsToTarget} ปี` : 'ยังไม่ถึงเป้าหมาย'}</h2>
            </div>
          </div>

          <div className="chart-container">
            <h3>📊 กราฟเปรียบเทียบการเติบโต</h3>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(value) => `$${value.toLocaleString()}`} />
                <Tooltip 
                  formatter={(value) => `$${value.toLocaleString()}`}
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }}
                />
                <Legend />
                <Area type="monotone" dataKey="totalValue" name="มูลค่ารวม (Total)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" />
                <Area type="monotone" dataKey="invested" name="เงินต้น (Invested)" stroke="#10b981" fillOpacity={1} fill="url(#colorInvested)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}